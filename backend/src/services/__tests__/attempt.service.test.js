jest.mock("../../lib/prisma", () => ({
  attempt: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  answer: {
    upsert: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  student: {
    upsert: jest.fn(),
  },
  publication: {
    findUnique: jest.fn(),
  },
  // Prisma exécute un tableau d'opérations en une seule transaction ;
  // pour le test, on se contente de les résoudre toutes.
  $transaction: jest.fn((operations) => Promise.all(operations)),
}));

jest.mock("../email.service", () => ({
  sendResultsPublishedEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../storage.service", () => ({
  buildAnswerObjectKey: jest.fn(),
  uploadFile: jest.fn(),
  downloadFileBuffer: jest.fn(),
  deleteFile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("mammoth", () => ({
  convertToHtml: jest.fn(),
}));

jest.mock("xlsx", () => ({
  read: jest.fn(),
  utils: {
    sheet_to_html: jest.fn(),
  },
}));

const prisma = require("../../lib/prisma");
const attemptCache = require("../../lib/attemptCache");
const storageService = require("../storage.service");
const mammoth = require("mammoth");
const XLSX = require("xlsx");
const {
  gradeAnswer,
  isPureQcm,
  gradeAttempt,
  withUpdatedAnswer,
  buildGradingContext,
  saveTextAnswer,
  saveFileAnswer,
  registerExit,
  getAttempt,
  getAnswerFileForTeacher,
  getAnswerFilePreview,
} = require("../attempt.service");

function buildQcmQuestion(overrides = {}) {
  return {
    id: "q-qcm",
    type: "QCM",
    points: 2,
    statement: "2 + 2 ?",
    correctAnswer: null,
    choices: [
      { id: "c-wrong", text: "3", correct: false, position: 0 },
      { id: "c-right", text: "4", correct: true, position: 1 },
    ],
    ...overrides,
  };
}

function buildShortTextQuestion(overrides = {}) {
  return {
    id: "q-short",
    type: "SHORT_TEXT",
    points: 3,
    statement: "Capitale de la France ?",
    correctAnswer: "Paris",
    choices: [],
    ...overrides,
  };
}

function buildLongTextQuestion(overrides = {}) {
  return {
    id: "q-long",
    type: "LONG_TEXT",
    points: 5,
    statement: "Explique la photosynthèse.",
    correctAnswer: null,
    choices: [],
    ...overrides,
  };
}

function buildAttemptFixture(overrides = {}) {
  return {
    id: "attempt-1",
    status: "IN_PROGRESS",
    exitCount: 0,
    startedAt: new Date(Date.now() - 60 * 60 * 1000),
    endsAt: new Date(Date.now() + 60 * 60 * 1000),
    submittedAt: null,
    score: null,
    resultsPublished: false,
    answers: [],
    student: {
      id: "student-1",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
    },
    publication: {
      id: "pub-1",
      status: "ACTIVE",
      duration: 60,
      availableAt: null,
      closesAt: null,
      evaluation: {
        title: "Évaluation test",
        type: "MIXED",
        instructions: "",
        questions: [buildQcmQuestion(), buildShortTextQuestion()],
      },
    },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  attemptCache.clear();
});

describe("gradeAnswer", () => {
  it("note un QCM correct au maximum des points", () => {
    const question = buildQcmQuestion();
    const answer = { textAnswer: "c-right" };

    expect(gradeAnswer(question, answer)).toBe(2);
  });

  it("note un QCM incorrect à zéro", () => {
    const question = buildQcmQuestion();
    const answer = { textAnswer: "c-wrong" };

    expect(gradeAnswer(question, answer)).toBe(0);
  });

  it("note un QCM sans réponse à zéro", () => {
    const question = buildQcmQuestion();

    expect(gradeAnswer(question, null)).toBe(0);
  });

  it("note une réponse courte correcte indépendamment de la casse/espaces", () => {
    const question = buildShortTextQuestion();
    const answer = { textAnswer: "  paris  " };

    expect(gradeAnswer(question, answer)).toBe(3);
  });

  it("note une réponse courte incorrecte à zéro", () => {
    const question = buildShortTextQuestion();
    const answer = { textAnswer: "Lyon" };

    expect(gradeAnswer(question, answer)).toBe(0);
  });

  it("renvoie null pour une réponse courte sans corrigé configuré", () => {
    const question = buildShortTextQuestion({ correctAnswer: null });
    const answer = { textAnswer: "Peu importe" };

    expect(gradeAnswer(question, answer)).toBeNull();
  });

  it("ne note jamais automatiquement une question à réponse longue", () => {
    const question = buildLongTextQuestion();
    const answer = { textAnswer: "Une longue réponse." };

    expect(gradeAnswer(question, answer)).toBeNull();
  });
});

describe("isPureQcm", () => {
  it("est vrai quand toutes les questions sont des QCM", () => {
    expect(isPureQcm([buildQcmQuestion(), buildQcmQuestion({ id: "q-qcm-2" })])).toBe(
      true
    );
  });

  it("est faux dès qu'une question n'est pas un QCM", () => {
    expect(isPureQcm([buildQcmQuestion(), buildShortTextQuestion()])).toBe(false);
  });

  it("est faux pour une liste vide de questions", () => {
    expect(isPureQcm([])).toBe(false);
  });
});

describe("withUpdatedAnswer", () => {
  it("ajoute la réponse si la question n'a pas encore de réponse", () => {
    const attempt = buildAttemptFixture({ answers: [] });
    const newAnswer = { questionId: "q-short", textAnswer: "Paris" };

    const result = withUpdatedAnswer(attempt, newAnswer);

    expect(result.answers).toEqual([newAnswer]);
  });

  it("remplace la réponse existante pour la même question", () => {
    const existing = { questionId: "q-short", textAnswer: "Lyon" };
    const attempt = buildAttemptFixture({ answers: [existing] });
    const updated = { questionId: "q-short", textAnswer: "Paris" };

    const result = withUpdatedAnswer(attempt, updated);

    expect(result.answers).toEqual([updated]);
  });

  it("ne modifie pas l'objet attempt d'origine (immutabilité)", () => {
    const attempt = buildAttemptFixture({ answers: [] });

    withUpdatedAnswer(attempt, { questionId: "q-short", textAnswer: "Paris" });

    expect(attempt.answers).toEqual([]);
  });

  it("préserve les autres champs de l'attempt", () => {
    const attempt = buildAttemptFixture({ exitCount: 2 });

    const result = withUpdatedAnswer(attempt, {
      questionId: "q-short",
      textAnswer: "Paris",
    });

    expect(result.exitCount).toBe(2);
    expect(result.id).toBe(attempt.id);
  });
});

describe("gradeAttempt", () => {
  it("additionne les scores des questions répondues et met à jour chaque réponse", async () => {
    const questions = [buildQcmQuestion(), buildShortTextQuestion()];

    prisma.answer.findMany.mockResolvedValue([
      { id: "ans-1", questionId: "q-qcm", textAnswer: "c-right" },
      { id: "ans-2", questionId: "q-short", textAnswer: "paris" },
    ]);

    const total = await gradeAttempt("attempt-1", questions);

    expect(total).toBe(5); // 2 (QCM) + 3 (SHORT_TEXT)
    expect(prisma.answer.update).toHaveBeenCalledTimes(2);
    expect(prisma.answer.update).toHaveBeenCalledWith({
      where: { id: "ans-1" },
      data: { score: 2 },
    });
    expect(prisma.answer.update).toHaveBeenCalledWith({
      where: { id: "ans-2" },
      data: { score: 3 },
    });
    // Les mises à jour sont regroupées en une seule transaction plutôt
    // qu'un aller-retour Prisma par question.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("ignore les questions sans réponse dans le total", async () => {
    const questions = [buildQcmQuestion(), buildShortTextQuestion()];

    prisma.answer.findMany.mockResolvedValue([
      { id: "ans-1", questionId: "q-qcm", textAnswer: "c-right" },
    ]);

    const total = await gradeAttempt("attempt-1", questions);

    expect(total).toBe(2);
    expect(prisma.answer.update).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("ne lance pas de transaction si aucune question n'a de réponse", async () => {
    const questions = [buildQcmQuestion(), buildShortTextQuestion()];

    prisma.answer.findMany.mockResolvedValue([]);

    const total = await gradeAttempt("attempt-1", questions);

    expect(total).toBe(0);
    expect(prisma.answer.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("saveTextAnswer (régression : pas de double-fetch)", () => {
  it("ne recharge le contexte complet de la tentative qu'une seule fois", async () => {
    const attempt = buildAttemptFixture();

    prisma.attempt.findUnique.mockResolvedValue(attempt);
    prisma.answer.upsert.mockResolvedValue({
      id: "ans-1",
      questionId: "q-short",
      attemptId: "attempt-1",
      textAnswer: "Paris",
      filePath: null,
      fileName: null,
      score: null,
    });

    const result = await saveTextAnswer("attempt-1", "q-short", "Paris");

    expect(prisma.attempt.findUnique).toHaveBeenCalledTimes(1);

    const answeredQuestion = result.questions.find(
      (question) => question.id === "q-short"
    );

    expect(answeredQuestion.answer.textAnswer).toBe("Paris");
  });

  it("rejette la sauvegarde si la tentative n'est plus en cours", async () => {
    const attempt = buildAttemptFixture({ status: "SUBMITTED" });

    prisma.attempt.findUnique.mockResolvedValue(attempt);

    await expect(
      saveTextAnswer("attempt-1", "q-short", "Paris")
    ).rejects.toMatchObject({ status: 409 });

    expect(prisma.answer.upsert).not.toHaveBeenCalled();
  });
});

describe("registerExit (régression : pas de double-fetch hors blocage)", () => {
  it("incrémente exitCount sans recharger le contexte complet une seconde fois", async () => {
    const attempt = buildAttemptFixture({ exitCount: 0 });

    prisma.attempt.findUnique.mockResolvedValue(attempt);
    prisma.attempt.update.mockResolvedValue({});

    const result = await registerExit("attempt-1");

    expect(prisma.attempt.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.attempt.update).toHaveBeenCalledWith({
      where: { id: "attempt-1" },
      data: { exitCount: 1 },
    });
    expect(result.attempt.exitCount).toBe(1);
  });

  it("bloque la tentative après 3 sorties d'onglet", async () => {
    const attempt = buildAttemptFixture({ exitCount: 2 });
    const blockedAttempt = buildAttemptFixture({
      exitCount: 3,
      status: "BLOCKED",
      submittedAt: new Date("2026-08-01T10:30:00Z"),
    });

    prisma.attempt.findUnique
      .mockResolvedValueOnce(attempt) // requireActiveAttempt
      .mockResolvedValueOnce(attempt) // refreshedAttempt avant finalizeAttempt
      .mockResolvedValueOnce(blockedAttempt); // getAttempt final

    prisma.attempt.update
      .mockResolvedValueOnce({}) // incrément exitCount
      .mockResolvedValueOnce({ ...blockedAttempt, answers: [] }); // finalizeAttempt

    prisma.answer.findMany.mockResolvedValue([]);

    const result = await registerExit("attempt-1");

    expect(prisma.attempt.findUnique).toHaveBeenCalledTimes(3);
    expect(result.attempt.status).toBe("BLOCKED");
  });
});

describe("cache mémoire du contexte de tentative", () => {
  it("réutilise le contexte en cache pour des lectures rapprochées", async () => {
    const attempt = buildAttemptFixture();

    prisma.attempt.findUnique.mockResolvedValue(attempt);

    await getAttempt("attempt-1");
    await getAttempt("attempt-1");

    expect(prisma.attempt.findUnique).toHaveBeenCalledTimes(1);
  });

  it("ne partage pas le cache entre deux tentatives différentes", async () => {
    const attemptA = buildAttemptFixture({ id: "attempt-1" });
    const attemptB = buildAttemptFixture({ id: "attempt-2" });

    prisma.attempt.findUnique.mockImplementation(({ where }) =>
      Promise.resolve(where.id === "attempt-1" ? attemptA : attemptB)
    );

    await getAttempt("attempt-1");
    await getAttempt("attempt-2");

    expect(prisma.attempt.findUnique).toHaveBeenCalledTimes(2);
  });

  it("invalide le cache après une écriture, forçant un nouveau chargement", async () => {
    const attempt = buildAttemptFixture();

    prisma.attempt.findUnique.mockResolvedValue(attempt);
    prisma.answer.upsert.mockResolvedValue({
      id: "ans-1",
      questionId: "q-short",
      attemptId: "attempt-1",
      textAnswer: "Paris",
      filePath: null,
      fileName: null,
      score: null,
    });

    await getAttempt("attempt-1"); // fetch #1, peuple le cache
    await saveTextAnswer("attempt-1", "q-short", "Paris"); // lit le cache, puis l'invalide après l'upsert
    await getAttempt("attempt-1"); // cache invalidé -> fetch #2

    expect(prisma.attempt.findUnique).toHaveBeenCalledTimes(2);
  });

  it("expire après le TTL même sans écriture", async () => {
    jest.useFakeTimers();

    try {
      const attempt = buildAttemptFixture();

      prisma.attempt.findUnique.mockResolvedValue(attempt);

      await getAttempt("attempt-1");
      jest.advanceTimersByTime(11 * 1000);
      await getAttempt("attempt-1");

      expect(prisma.attempt.findUnique).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("buildGradingContext", () => {
  it("exclut la question en cours de correction", () => {
    const attempt = buildAttemptFixture({
      answers: [
        {
          questionId: "q-short",
          textAnswer: "Paris",
          score: 3,
          gradedBy: "AI",
        },
      ],
    });

    const context = buildGradingContext(attempt, "q-short");

    expect(context).toEqual([]);
  });

  it("exclut les réponses non encore notées", () => {
    const attempt = buildAttemptFixture({
      answers: [
        {
          questionId: "q-short",
          textAnswer: "Paris",
          score: null,
          gradedBy: null,
        },
      ],
    });

    const context = buildGradingContext(attempt, "q-qcm");

    expect(context).toEqual([]);
  });

  it("inclut les réponses déjà notées avec l'énoncé et le barème", () => {
    const attempt = buildAttemptFixture({
      answers: [
        {
          questionId: "q-short",
          textAnswer: "Paris",
          score: 3,
          gradedBy: "TEACHER",
        },
      ],
    });

    const context = buildGradingContext(attempt, "q-qcm");

    expect(context).toEqual([
      {
        statement: "Capitale de la France ?",
        points: 3,
        textAnswer: "Paris",
        score: 3,
      },
    ]);
  });

  it("plafonne le nombre de questions incluses dans le contexte", () => {
    const questions = Array.from({ length: 6 }, (_, index) =>
      buildShortTextQuestion({ id: `q-${index}` })
    );

    const answers = questions.map((question, index) => ({
      questionId: question.id,
      textAnswer: `Réponse ${index}`,
      score: 2,
      gradedBy: "AI",
    }));

    const attempt = buildAttemptFixture({
      answers,
      publication: {
        id: "pub-1",
        status: "ACTIVE",
        duration: 60,
        availableAt: null,
        closesAt: null,
        evaluation: {
          title: "Évaluation test",
          type: "MIXED",
          instructions: "",
          questions,
        },
      },
    });

    const context = buildGradingContext(attempt, "q-none");

    expect(context).toHaveLength(5);
  });
});

describe("saveFileAnswer (stockage objet)", () => {
  it("téléverse le fichier vers le stockage objet et n'invalide qu'un seul fetch complet", async () => {
    const attempt = buildAttemptFixture();

    prisma.attempt.findUnique.mockResolvedValue(attempt);
    storageService.buildAnswerObjectKey.mockReturnValue(
      "answers/attempt-1/q-short/123.pdf"
    );
    storageService.uploadFile.mockResolvedValue(undefined);
    prisma.answer.upsert.mockResolvedValue({
      id: "ans-1",
      questionId: "q-short",
      attemptId: "attempt-1",
      textAnswer: null,
      filePath: "answers/attempt-1/q-short/123.pdf",
      fileName: "devoir.pdf",
      score: null,
    });

    const result = await saveFileAnswer(
      "attempt-1",
      "q-short",
      "/tmp/upload-xyz",
      "devoir.pdf",
      "application/pdf"
    );

    expect(storageService.uploadFile).toHaveBeenCalledWith(
      "/tmp/upload-xyz",
      "answers/attempt-1/q-short/123.pdf",
      "application/pdf"
    );
    expect(prisma.attempt.findUnique).toHaveBeenCalledTimes(1);

    const answeredQuestion = result.questions.find(
      (question) => question.id === "q-short"
    );

    expect(answeredQuestion.answer.filePath).toBe(
      "answers/attempt-1/q-short/123.pdf"
    );
  });

  it("supprime l'ancien fichier sur le stockage objet lors du remplacement d'une réponse", async () => {
    const attempt = buildAttemptFixture({
      answers: [
        {
          questionId: "q-short",
          filePath: "answers/old/key.pdf",
          fileName: "old.pdf",
        },
      ],
    });

    prisma.attempt.findUnique.mockResolvedValue(attempt);
    storageService.buildAnswerObjectKey.mockReturnValue(
      "answers/attempt-1/q-short/456.pdf"
    );
    storageService.uploadFile.mockResolvedValue(undefined);
    prisma.answer.upsert.mockResolvedValue({
      id: "ans-1",
      questionId: "q-short",
      attemptId: "attempt-1",
      filePath: "answers/attempt-1/q-short/456.pdf",
      fileName: "new.pdf",
    });

    await saveFileAnswer(
      "attempt-1",
      "q-short",
      "/tmp/upload-new",
      "new.pdf",
      "application/pdf"
    );

    expect(storageService.deleteFile).toHaveBeenCalledWith(
      "answers/old/key.pdf"
    );
  });
});

describe("getAnswerFileForTeacher", () => {
  it("télécharge le buffer du fichier depuis le stockage objet", async () => {
    const attempt = buildAttemptFixture({
      answers: [
        {
          questionId: "q-short",
          filePath: "answers/x/devoir.pdf",
          fileName: "devoir.pdf",
        },
      ],
    });

    prisma.attempt.findFirst.mockResolvedValue(attempt);
    storageService.downloadFileBuffer.mockResolvedValue(
      Buffer.from("contenu")
    );

    const result = await getAnswerFileForTeacher(
      "attempt-1",
      "q-short",
      "teacher-1"
    );

    expect(storageService.downloadFileBuffer).toHaveBeenCalledWith(
      "answers/x/devoir.pdf"
    );
    expect(result.buffer).toEqual(Buffer.from("contenu"));
    expect(result.fileName).toBe("devoir.pdf");
  });

  it("rejette avec une erreur 404 si aucun fichier n'a été envoyé", async () => {
    const attempt = buildAttemptFixture({ answers: [] });

    prisma.attempt.findFirst.mockResolvedValue(attempt);

    await expect(
      getAnswerFileForTeacher("attempt-1", "q-short", "teacher-1")
    ).rejects.toMatchObject({ status: 404 });

    expect(storageService.downloadFileBuffer).not.toHaveBeenCalled();
  });
});

describe("getAnswerFilePreview", () => {
  it("convertit un .docx en HTML via mammoth", async () => {
    const attempt = buildAttemptFixture({
      answers: [
        {
          questionId: "q-short",
          filePath: "answers/x/devoir.docx",
          fileName: "devoir.docx",
        },
      ],
    });

    prisma.attempt.findFirst.mockResolvedValue(attempt);
    storageService.downloadFileBuffer.mockResolvedValue(
      Buffer.from("docx-bytes")
    );
    mammoth.convertToHtml.mockResolvedValue({ value: "<p>Contenu</p>" });

    const result = await getAnswerFilePreview(
      "attempt-1",
      "q-short",
      "teacher-1"
    );

    expect(mammoth.convertToHtml).toHaveBeenCalledWith({
      buffer: Buffer.from("docx-bytes"),
    });
    expect(result).toEqual({ previewType: "html", html: "<p>Contenu</p>" });
  });

  it("convertit un .xlsx en HTML via xlsx", async () => {
    const attempt = buildAttemptFixture({
      answers: [
        {
          questionId: "q-short",
          filePath: "answers/x/notes.xlsx",
          fileName: "notes.xlsx",
        },
      ],
    });

    prisma.attempt.findFirst.mockResolvedValue(attempt);
    storageService.downloadFileBuffer.mockResolvedValue(
      Buffer.from("xlsx-bytes")
    );

    const sheet = {};
    XLSX.read.mockReturnValue({
      SheetNames: ["Feuil1"],
      Sheets: { Feuil1: sheet },
    });
    XLSX.utils.sheet_to_html.mockReturnValue("<table></table>");

    const result = await getAnswerFilePreview(
      "attempt-1",
      "q-short",
      "teacher-1"
    );

    expect(XLSX.read).toHaveBeenCalledWith(Buffer.from("xlsx-bytes"), {
      type: "buffer",
    });
    expect(result).toEqual({ previewType: "html", html: "<table></table>" });
  });

  it("renvoie unsupported pour un type de fichier non pris en charge, sans téléchargement", async () => {
    const attempt = buildAttemptFixture({
      answers: [
        {
          questionId: "q-short",
          filePath: "answers/x/photo.png",
          fileName: "photo.png",
        },
      ],
    });

    prisma.attempt.findFirst.mockResolvedValue(attempt);

    const result = await getAnswerFilePreview(
      "attempt-1",
      "q-short",
      "teacher-1"
    );

    expect(result).toEqual({ previewType: "unsupported" });
    expect(storageService.downloadFileBuffer).not.toHaveBeenCalled();
  });
});
