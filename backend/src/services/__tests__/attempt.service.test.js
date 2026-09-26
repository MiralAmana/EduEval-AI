jest.mock("../../lib/prisma", () => ({
  attempt: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  answer: {
    upsert: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  question: {
    findFirst: jest.fn(),
  },
  criterionScore: {
    upsert: jest.fn(),
    deleteMany: jest.fn(),
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

jest.mock("../grading.service", () => ({
  gradeAnswerWithAI: jest.fn(),
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
const { gradeAnswerWithAI } = require("../grading.service");
const {
  gradeAnswer,
  isPureQcm,
  gradeAttempt,
  withUpdatedAnswer,
  buildGradingContext,
  saveTextAnswer,
  saveFileAnswer,
  registerExit,
  joinPublication,
  submitAttempt,
  getAttempt,
  getAnswerFileForTeacher,
  getAnswerFilePreview,
  getQuestionAnswersForReview,
  gradeAnswerManually,
  gradeAnswerWithAiAssist,
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
    criteria: [],
    ...overrides,
  };
}

function buildLongTextQuestionWithCriteria(overrides = {}) {
  return buildLongTextQuestion({
    criteria: [
      { id: "crit-clarte", label: "Clarté", points: 2 },
      { id: "crit-exactitude", label: "Exactitude", points: 3 },
    ],
    ...overrides,
  });
}

function buildTeacherAttemptFixture(question, overrides = {}) {
  return {
    id: "attempt-1",
    status: "SUBMITTED",
    exitCount: 0,
    startedAt: new Date(Date.now() - 60 * 60 * 1000),
    endsAt: new Date(Date.now() + 60 * 60 * 1000),
    submittedAt: new Date(),
    score: 0,
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
        questions: [question],
      },
    },
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
    // Une écriture par note distincte (ici 2 notes différentes : 2 et 3).
    expect(prisma.answer.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.answer.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["ans-1"] } },
      data: { score: 2 },
    });
    expect(prisma.answer.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["ans-2"] } },
      data: { score: 3 },
    });
    expect(prisma.answer.update).not.toHaveBeenCalled();
    // Les écritures sont regroupées en une seule transaction.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("regroupe en une seule écriture toutes les réponses qui ont la même note", async () => {
    const questions = [
      buildQcmQuestion({ id: "q1" }),
      buildQcmQuestion({ id: "q2" }),
      buildQcmQuestion({ id: "q3" }),
    ];

    prisma.answer.findMany.mockResolvedValue([
      { id: "a1", questionId: "q1", textAnswer: "c-right" },
      { id: "a2", questionId: "q2", textAnswer: "c-right" },
      { id: "a3", questionId: "q3", textAnswer: "c-wrong" },
    ]);

    const total = await gradeAttempt("attempt-1", questions);

    expect(total).toBe(4);
    expect(prisma.answer.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.answer.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["a1", "a2"] } },
      data: { score: 2 },
    });
    expect(prisma.answer.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["a3"] } },
      data: { score: 0 },
    });
  });

  it("n'écrase pas la note d'une question à corriger par l'enseignant", async () => {
    const questions = [buildQcmQuestion(), buildLongTextQuestion()];

    prisma.answer.findMany.mockResolvedValue([
      { id: "ans-1", questionId: "q-qcm", textAnswer: "c-right" },
      { id: "ans-2", questionId: "q-long", textAnswer: "texte", score: 4 },
    ]);

    await gradeAttempt("attempt-1", questions);

    expect(prisma.answer.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.answer.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["ans-1"] } },
      data: { score: 2 },
    });
  });

  it("ignore les questions sans réponse dans le total", async () => {
    const questions = [buildQcmQuestion(), buildShortTextQuestion()];

    prisma.answer.findMany.mockResolvedValue([
      { id: "ans-1", questionId: "q-qcm", textAnswer: "c-right" },
    ]);

    const total = await gradeAttempt("attempt-1", questions);

    expect(total).toBe(2);
    expect(prisma.answer.updateMany).toHaveBeenCalledTimes(1);
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

    prisma.attempt.findUnique.mockResolvedValue(attempt);
    prisma.attempt.update.mockResolvedValue({});
    prisma.answer.findMany.mockResolvedValue([]);

    const result = await registerExit("attempt-1");

    // Le contexte n'est chargé qu'une fois : le blocage construit l'état
    // final en mémoire au lieu de recharger la tentative deux fois de plus.
    expect(prisma.attempt.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.attempt.update).toHaveBeenCalledWith({
      where: { id: "attempt-1" },
      data: expect.objectContaining({ status: "BLOCKED" }),
    });
    expect(result.attempt.status).toBe("BLOCKED");
    expect(result.attempt.exitCount).toBe(3);
  });
});

describe("joinPublication", () => {
  it("crée la tentative sans relire tout son contexte en base et la met en cache", async () => {
    const source = buildAttemptFixture();

    prisma.publication.findUnique.mockResolvedValue(source.publication);
    prisma.student.upsert.mockResolvedValue(source.student);
    prisma.attempt.findUnique.mockResolvedValue(null); // pas de tentative existante
    prisma.attempt.create.mockResolvedValue({
      id: "attempt-neuve",
      publicationId: "pub-1",
      studentId: "student-1",
      status: "IN_PROGRESS",
      exitCount: 0,
      startedAt: new Date(),
      endsAt: new Date(Date.now() + 60 * 60 * 1000),
      submittedAt: null,
      score: null,
      resultsPublished: false,
    });

    const payload = await joinPublication({
      code: "abc234",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "Ada@Example.com",
    });

    expect(payload.attempt.id).toBe("attempt-neuve");
    expect(payload.questions).toHaveLength(2);
    // Une lecture pour chercher une tentative existante (aucune), zéro pour
    // recharger celle qui vient d'être créée.
    expect(prisma.attempt.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.attempt.create).toHaveBeenCalledWith({
      data: expect.not.objectContaining({ include: expect.anything() }),
    });

    // La première sauvegarde de réponse trouve le contexte en cache.
    prisma.answer.upsert.mockResolvedValue({
      id: "ans-1",
      questionId: "q-short",
      attemptId: "attempt-neuve",
      textAnswer: "Paris",
      filePath: null,
      fileName: null,
      score: null,
    });

    await saveTextAnswer("attempt-neuve", "q-short", "Paris");

    expect(prisma.attempt.findUnique).toHaveBeenCalledTimes(1);
  });

  it("ne révèle pas les bonnes réponses dans la charge utile renvoyée à l'élève", async () => {
    const source = buildAttemptFixture();

    prisma.publication.findUnique.mockResolvedValue(source.publication);
    prisma.student.upsert.mockResolvedValue(source.student);
    prisma.attempt.findUnique.mockResolvedValue(null);
    prisma.attempt.create.mockResolvedValue({
      id: "attempt-neuve",
      status: "IN_PROGRESS",
      exitCount: 0,
      startedAt: new Date(),
      endsAt: new Date(Date.now() + 60 * 60 * 1000),
      submittedAt: null,
      score: null,
      resultsPublished: false,
    });

    const payload = await joinPublication({
      code: "ABC234",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
    });

    const json = JSON.stringify(payload);

    expect(json).not.toContain("correctAnswer");
    expect(payload.questions[0].choices.every((choice) => !("correct" in choice))).toBe(true);
  });
});

describe("submitAttempt", () => {
  it("note et clôture la tentative en une seule transaction, sans recharger le contexte complet", async () => {
    const attempt = buildAttemptFixture();

    prisma.attempt.findUnique.mockResolvedValue(attempt);
    prisma.attempt.update.mockResolvedValue({});
    prisma.answer.findMany.mockResolvedValue([
      { id: "ans-1", questionId: "q-qcm", textAnswer: "c-right", criterionScores: [] },
      { id: "ans-2", questionId: "q-short", textAnswer: "paris", criterionScores: [] },
    ]);

    const result = await submitAttempt("attempt-1");

    expect(prisma.attempt.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.attempt.update).toHaveBeenCalledTimes(1);
    expect(prisma.attempt.update).toHaveBeenCalledWith({
      where: { id: "attempt-1" },
      data: {
        status: "SUBMITTED",
        submittedAt: expect.any(Date),
        score: 5,
        resultsPublished: false,
      },
    });
    expect(result.attempt.status).toBe("SUBMITTED");
    expect(result.attempt.submittedAt).toBeInstanceOf(Date);
    // Évaluation non 100 % QCM : la note reste masquée jusqu'à la publication.
    expect(result.attempt.score).toBeNull();
  });

  it("révèle la note tout de suite pour une évaluation 100 % QCM, sans attendre l'email", async () => {
    const attempt = buildAttemptFixture({
      publication: {
        ...buildAttemptFixture().publication,
        evaluation: {
          ...buildAttemptFixture().publication.evaluation,
          questions: [buildQcmQuestion()],
        },
      },
    });

    prisma.attempt.findUnique.mockResolvedValue(attempt);
    prisma.attempt.update.mockResolvedValue({});
    prisma.answer.findMany.mockResolvedValue([
      { id: "ans-1", questionId: "q-qcm", textAnswer: "c-right", criterionScores: [] },
    ]);

    // L'envoi de l'email ne se termine jamais : la soumission doit répondre quand même.
    const { sendResultsPublishedEmail } = require("../email.service");
    sendResultsPublishedEmail.mockReturnValueOnce(new Promise(() => {}));

    const result = await submitAttempt("attempt-1");

    expect(result.attempt.score).toBe(2);
    expect(result.attempt.resultsPublished).toBe(true);
    expect(result.questions[0].answer.score).toBe(2);
    expect(sendResultsPublishedEmail).toHaveBeenCalledTimes(1);
  });

  it("est idempotent : une tentative déjà soumise renvoie son état sans rien écrire", async () => {
    const attempt = buildAttemptFixture({
      status: "SUBMITTED",
      submittedAt: new Date(),
    });

    prisma.attempt.findUnique.mockResolvedValue(attempt);

    const result = await submitAttempt("attempt-1");

    expect(result.attempt.status).toBe("SUBMITTED");
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.attempt.update).not.toHaveBeenCalled();
  });

  it("clôture une tentative dont le temps est écoulé (EXPIRED) et renvoie son état au lieu d'une erreur", async () => {
    const attempt = buildAttemptFixture({
      endsAt: new Date(Date.now() - 1000),
    });

    prisma.attempt.findUnique.mockResolvedValue(attempt);
    prisma.attempt.update.mockResolvedValue({});
    prisma.answer.findMany.mockResolvedValue([]);

    const result = await submitAttempt("attempt-1");

    expect(prisma.attempt.update).toHaveBeenCalledWith({
      where: { id: "attempt-1" },
      data: expect.objectContaining({ status: "EXPIRED" }),
    });
    expect(result.attempt.status).toBe("EXPIRED");
  });

  it("répond 404 pour une tentative inconnue", async () => {
    prisma.attempt.findUnique.mockResolvedValue(null);

    await expect(submitAttempt("inconnue")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("refuse la soumission si l'évaluation a été désactivée (403)", async () => {
    const attempt = buildAttemptFixture();
    attempt.publication.status = "DISABLED";

    prisma.attempt.findUnique.mockResolvedValue(attempt);

    await expect(submitAttempt("attempt-1")).rejects.toMatchObject({
      status: 403,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("met à jour le cache avec l'état final : la lecture suivante ne relit pas la base", async () => {
    const attempt = buildAttemptFixture();

    prisma.attempt.findUnique.mockResolvedValue(attempt);
    prisma.attempt.update.mockResolvedValue({});
    prisma.answer.findMany.mockResolvedValue([]);

    await submitAttempt("attempt-1");
    const result = await getAttempt("attempt-1");

    expect(prisma.attempt.findUnique).toHaveBeenCalledTimes(1);
    expect(result.attempt.status).toBe("SUBMITTED");
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

  it("met à jour le cache en place après une écriture : pas de rechargement, et la lecture suivante voit la réponse", async () => {
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
    await saveTextAnswer("attempt-1", "q-short", "Paris"); // met le cache à jour
    const result = await getAttempt("attempt-1"); // servi par le cache

    expect(prisma.attempt.findUnique).toHaveBeenCalledTimes(1);
    expect(
      result.questions.find((question) => question.id === "q-short").answer
        .textAnswer
    ).toBe("Paris");
  });

  it("n'allonge pas la durée de vie du cache : une écriture ne repousse pas l'expiration", async () => {
    jest.useFakeTimers();

    try {
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

      await getAttempt("attempt-1"); // t = 0 : fetch #1
      jest.advanceTimersByTime(6 * 1000);
      await saveTextAnswer("attempt-1", "q-short", "Paris"); // t = 6 s
      jest.advanceTimersByTime(5 * 1000); // t = 11 s > TTL de 10 s
      await getAttempt("attempt-1"); // expiré malgré l'écriture -> fetch #2

      // Sinon un élève qui sauvegarde sans arrêt ne verrait jamais une
      // évaluation désactivée entre-temps par l'enseignant.
      expect(prisma.attempt.findUnique).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it("cumule deux sauvegardes qui se chevauchent au lieu de s'écraser mutuellement", async () => {
    const attempt = buildAttemptFixture();

    prisma.attempt.findUnique.mockResolvedValue(attempt);
    prisma.answer.upsert.mockImplementation(({ where }) =>
      Promise.resolve({
        id: `ans-${where.questionId_attemptId.questionId}`,
        questionId: where.questionId_attemptId.questionId,
        attemptId: "attempt-1",
        textAnswer:
          where.questionId_attemptId.questionId === "q-qcm" ? "c-right" : "Paris",
        filePath: null,
        fileName: null,
        score: null,
      })
    );

    await getAttempt("attempt-1"); // peuple le cache

    await Promise.all([
      saveTextAnswer("attempt-1", "q-qcm", "c-right"),
      saveTextAnswer("attempt-1", "q-short", "Paris"),
    ]);

    const result = await getAttempt("attempt-1");
    const byId = Object.fromEntries(
      result.questions.map((question) => [question.id, question.answer])
    );

    expect(prisma.attempt.findUnique).toHaveBeenCalledTimes(1);
    expect(byId["q-qcm"].textAnswer).toBe("c-right");
    expect(byId["q-short"].textAnswer).toBe("Paris");
  });

  it("garde la même forme qu'un chargement en base (criterionScores) après une écriture", async () => {
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

    await getAttempt("attempt-1");
    await saveTextAnswer("attempt-1", "q-short", "Paris");

    const cached = attemptCache.get("attempt-1");

    expect(cached.answers[0].criterionScores).toEqual([]);
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

  it("neutralise le HTML dangereux renvoyé par mammoth avant de le renvoyer au client", async () => {
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
    mammoth.convertToHtml.mockResolvedValue({
      value: '<p onclick="alert(1)">Contenu</p><script>alert(1)</script>',
    });

    const result = await getAnswerFilePreview(
      "attempt-1",
      "q-short",
      "teacher-1"
    );

    expect(result.html).not.toContain("<script");
    expect(result.html).not.toContain("onclick");
    expect(result.html).toContain("Contenu");
  });

  it("neutralise un lien javascript: dans l'aperçu .xlsx avant de le renvoyer au client", async () => {
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
    XLSX.utils.sheet_to_html.mockReturnValue(
      '<table><tr><td><a href="javascript:alert(document.cookie)">clic</a></td></tr></table>'
    );

    const result = await getAnswerFilePreview(
      "attempt-1",
      "q-short",
      "teacher-1"
    );

    expect(result.html).not.toContain("javascript:");
    expect(result.html).toContain("clic");
  });

  it("n'affiche pas le titre technique 'SheetJS Table Export' de l'enveloppe HTML de xlsx", async () => {
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
    XLSX.read.mockReturnValue({
      SheetNames: ["Feuil1"],
      Sheets: { Feuil1: {} },
    });
    XLSX.utils.sheet_to_html.mockReturnValue(
      '<html><head><meta charset="utf-8"/><title>SheetJS Table Export</title></head><body><table><tr><td>Note</td></tr></table></body></html>'
    );

    const result = await getAnswerFilePreview(
      "attempt-1",
      "q-short",
      "teacher-1"
    );

    expect(result.html).not.toContain("SheetJS");
    expect(result.html).toContain("<td>Note</td>");
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

describe("getQuestionAnswersForReview", () => {
  it("renvoie null si la question n'appartient pas à une évaluation de l'enseignant", async () => {
    prisma.question.findFirst.mockResolvedValue(null);

    const result = await getQuestionAnswersForReview(
      "eval-1",
      "q-short",
      "teacher-1"
    );

    expect(result).toBeNull();
    expect(prisma.attempt.findMany).not.toHaveBeenCalled();
  });

  it("ne récupère que les tentatives terminées de cette évaluation", async () => {
    prisma.question.findFirst.mockResolvedValue({
      id: "q-short",
      statement: "Capitale de la France ?",
      type: "SHORT_TEXT",
      points: 3,
      correctAnswer: "Paris",
      choices: [],
    });
    prisma.attempt.findMany.mockResolvedValue([]);

    await getQuestionAnswersForReview("eval-1", "q-short", "teacher-1");

    const callArgs = prisma.attempt.findMany.mock.calls[0][0];

    expect(callArgs.where.status).toEqual({ not: "IN_PROGRESS" });
    expect(callArgs.where.publication).toEqual({ evaluationId: "eval-1" });
  });

  it("inclut les copies n'ayant pas répondu à la question, avec une réponse nulle", async () => {
    prisma.question.findFirst.mockResolvedValue({
      id: "q-short",
      statement: "Capitale de la France ?",
      type: "SHORT_TEXT",
      points: 3,
      correctAnswer: "Paris",
      choices: [],
    });

    prisma.attempt.findMany.mockResolvedValue([
      {
        id: "attempt-blank",
        status: "SUBMITTED",
        student: {
          firstName: "Ana",
          lastName: "Blanc",
          email: "ana@example.com",
        },
        answers: [],
      },
      {
        id: "attempt-graded",
        status: "SUBMITTED",
        student: {
          firstName: "Bo",
          lastName: "Curie",
          email: "bo@example.com",
        },
        answers: [
          {
            textAnswer: "Paris",
            score: 3,
            feedback: "Bien",
            gradedBy: "TEACHER",
            filePath: null,
            fileName: null,
            criterionScores: [],
          },
        ],
      },
    ]);

    const result = await getQuestionAnswersForReview(
      "eval-1",
      "q-short",
      "teacher-1"
    );

    expect(result.question.id).toBe("q-short");
    expect(result.answers).toHaveLength(2);

    const blank = result.answers.find(
      (answer) => answer.attemptId === "attempt-blank"
    );
    expect(blank.textAnswer).toBeNull();
    expect(blank.score).toBeNull();

    const graded = result.answers.find(
      (answer) => answer.attemptId === "attempt-graded"
    );
    expect(graded.score).toBe(3);
    expect(graded.student.firstName).toBe("Bo");
  });
});

describe("gradeAnswerManually", () => {
  it("note avec un score global quand la question n'a pas de barème détaillé", async () => {
    const question = buildShortTextQuestion({ criteria: [] });
    const attempt = buildTeacherAttemptFixture(question);

    prisma.attempt.findFirst.mockResolvedValue(attempt);
    prisma.answer.upsert.mockResolvedValue({
      id: "ans-1",
      questionId: question.id,
      attemptId: "attempt-1",
    });
    prisma.answer.findMany.mockResolvedValue([]);

    await gradeAnswerManually("attempt-1", question.id, "teacher-1", {
      score: 2,
      feedback: "Bien",
    });

    expect(prisma.answer.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          score: 2,
          feedback: "Bien",
          gradedBy: "TEACHER",
        }),
      })
    );
    expect(prisma.criterionScore.upsert).not.toHaveBeenCalled();
  });

  it("calcule le score total à partir des critères et enregistre le détail", async () => {
    const question = buildLongTextQuestionWithCriteria();
    const attempt = buildTeacherAttemptFixture(question);

    prisma.attempt.findFirst.mockResolvedValue(attempt);
    prisma.answer.upsert.mockResolvedValue({
      id: "ans-1",
      questionId: question.id,
      attemptId: "attempt-1",
    });
    prisma.answer.findMany.mockResolvedValue([]);

    await gradeAnswerManually("attempt-1", question.id, "teacher-1", {
      criterionScores: [
        { criterionId: "crit-clarte", pointsAwarded: 2 },
        { criterionId: "crit-exactitude", pointsAwarded: 2 },
      ],
    });

    expect(prisma.answer.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ score: 4 }),
      })
    );
    expect(prisma.criterionScore.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.criterionScore.deleteMany).toHaveBeenCalledWith({
      where: {
        answerId: "ans-1",
        criterionId: { notIn: ["crit-clarte", "crit-exactitude"] },
      },
    });
  });

  it("plafonne chaque critère à son maximum et ignore les identifiants inconnus", async () => {
    const question = buildLongTextQuestionWithCriteria();
    const attempt = buildTeacherAttemptFixture(question);

    prisma.attempt.findFirst.mockResolvedValue(attempt);
    prisma.answer.upsert.mockResolvedValue({
      id: "ans-1",
      questionId: question.id,
      attemptId: "attempt-1",
    });
    prisma.answer.findMany.mockResolvedValue([]);

    await gradeAnswerManually("attempt-1", question.id, "teacher-1", {
      criterionScores: [
        { criterionId: "crit-clarte", pointsAwarded: 99 },
        { criterionId: "crit-inconnu", pointsAwarded: 10 },
      ],
    });

    expect(prisma.answer.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ score: 2 }),
      })
    );
    expect(prisma.criterionScore.upsert).toHaveBeenCalledTimes(1);
  });
});

describe("gradeAnswerWithAiAssist", () => {
  it("transmet le barème de la question à l'IA et enregistre le détail par critère", async () => {
    const question = buildLongTextQuestionWithCriteria();
    const attempt = buildTeacherAttemptFixture(question);

    prisma.attempt.findFirst.mockResolvedValue(attempt);
    gradeAnswerWithAI.mockResolvedValue({
      score: 4,
      feedback: "Bien.",
      criterionScores: [
        { criterionId: "crit-clarte", pointsAwarded: 2 },
        { criterionId: "crit-exactitude", pointsAwarded: 2 },
      ],
    });
    prisma.answer.upsert.mockResolvedValue({
      id: "ans-1",
      questionId: question.id,
      attemptId: "attempt-1",
    });
    prisma.answer.findMany.mockResolvedValue([]);

    await gradeAnswerWithAiAssist("attempt-1", question.id, "teacher-1");

    expect(gradeAnswerWithAI).toHaveBeenCalledWith(
      question,
      undefined,
      [],
      question.criteria
    );
    expect(prisma.criterionScore.upsert).toHaveBeenCalledTimes(2);
  });

  it("n'enregistre aucun détail par critère quand la question n'a pas de barème", async () => {
    const question = buildShortTextQuestion({ criteria: [] });
    const attempt = buildTeacherAttemptFixture(question);

    prisma.attempt.findFirst.mockResolvedValue(attempt);
    gradeAnswerWithAI.mockResolvedValue({
      score: 3,
      feedback: "Bien.",
      criterionScores: null,
    });
    prisma.answer.upsert.mockResolvedValue({
      id: "ans-1",
      questionId: question.id,
      attemptId: "attempt-1",
    });
    prisma.answer.findMany.mockResolvedValue([]);

    await gradeAnswerWithAiAssist("attempt-1", question.id, "teacher-1");

    expect(prisma.criterionScore.upsert).not.toHaveBeenCalled();
  });
});
