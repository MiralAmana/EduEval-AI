const mockTransactionClient = {
  evaluation: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  question: {
    deleteMany: jest.fn(),
  },
  publication: {
    findFirst: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
};

jest.mock("../../lib/prisma", () => ({
  evaluation: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
  },
  attempt: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockTransactionClient)),
}));

jest.mock("../../lib/publicationCode", () => ({
  generateUniqueCode: jest.fn().mockResolvedValue("ABC123"),
}));

const prisma = require("../../lib/prisma");
const { generateUniqueCode } = require("../../lib/publicationCode");
const evaluationService = require("../evaluation.service");

beforeEach(() => {
  jest.clearAllMocks();
  generateUniqueCode.mockResolvedValue("ABC123");
});

describe("createEvaluation", () => {
  it("crée l'évaluation avec les questions préparées, sans publication pour un brouillon", async () => {
    mockTransactionClient.evaluation.create.mockResolvedValue({
      id: "eval-1",
      title: "Titre",
      duration: 30,
    });
    mockTransactionClient.evaluation.findUnique.mockResolvedValue({
      id: "eval-1",
      title: "Titre",
    });

    const result = await evaluationService.createEvaluation(
      {
        title: "Titre",
        duration: 30,
        status: "DRAFT",
        questions: [
          {
            statement: "2 + 2 ?",
            type: "QCM",
            points: 2,
            correctAnswer: "4",
            choices: ["3", "4"],
          },
        ],
      },
      "user-1"
    );

    expect(mockTransactionClient.evaluation.create).toHaveBeenCalledTimes(1);

    const createArgs = mockTransactionClient.evaluation.create.mock.calls[0][0];
    const preparedQuestion = createArgs.data.questions.create[0];

    expect(preparedQuestion.statement).toBe("2 + 2 ?");
    expect(preparedQuestion.choices.create).toEqual([
      { text: "3", position: 0, correct: false },
      { text: "4", position: 1, correct: true },
    ]);

    expect(mockTransactionClient.publication.create).not.toHaveBeenCalled();
    expect(result).toEqual({ id: "eval-1", title: "Titre" });
  });

  it("crée une publication active quand le statut est ACTIVE et qu'aucune publication n'existe", async () => {
    mockTransactionClient.evaluation.create.mockResolvedValue({
      id: "eval-1",
      title: "Titre",
      duration: 30,
    });
    mockTransactionClient.publication.findFirst.mockResolvedValue(null);
    mockTransactionClient.evaluation.findUnique.mockResolvedValue({
      id: "eval-1",
    });

    await evaluationService.createEvaluation(
      { title: "Titre", duration: 30, status: "ACTIVE", questions: [] },
      "user-1"
    );

    expect(mockTransactionClient.publication.create).toHaveBeenCalledWith({
      data: {
        name: "Titre — Publication",
        code: "ABC123",
        duration: 30,
        status: "ACTIVE",
        evaluationId: "eval-1",
      },
    });
  });

  it("marque la bonne réponse d'un QCM indépendamment de la casse", async () => {
    mockTransactionClient.evaluation.create.mockResolvedValue({ id: "eval-1" });
    mockTransactionClient.evaluation.findUnique.mockResolvedValue({});

    await evaluationService.createEvaluation(
      {
        title: "T",
        duration: 10,
        status: "DRAFT",
        questions: [
          {
            statement: "Capitale ?",
            type: "QCM",
            correctAnswer: "PARIS",
            choices: ["Lyon", "paris"],
          },
        ],
      },
      "user-1"
    );

    const createArgs = mockTransactionClient.evaluation.create.mock.calls[0][0];
    const choices = createArgs.data.questions.create[0].choices.create;

    expect(choices).toEqual([
      { text: "Lyon", position: 0, correct: false },
      { text: "paris", position: 1, correct: true },
    ]);
  });

  it("crée le barème détaillé d'une question", async () => {
    mockTransactionClient.evaluation.create.mockResolvedValue({ id: "eval-1" });
    mockTransactionClient.evaluation.findUnique.mockResolvedValue({});

    await evaluationService.createEvaluation(
      {
        title: "T",
        duration: 10,
        status: "DRAFT",
        questions: [
          {
            statement: "Explique la photosynthèse",
            type: "LONG_TEXT",
            points: 5,
            criteria: [
              { label: "Clarté", points: 2 },
              { label: "Exactitude", points: 3 },
            ],
          },
        ],
      },
      "user-1"
    );

    const createArgs = mockTransactionClient.evaluation.create.mock.calls[0][0];
    const criteria = createArgs.data.questions.create[0].criteria.create;

    expect(criteria).toEqual([
      { label: "Clarté", points: 2, position: 0 },
      { label: "Exactitude", points: 3, position: 1 },
    ]);
  });

  it("ignore les critères sans intitulé ou sans points positifs", async () => {
    mockTransactionClient.evaluation.create.mockResolvedValue({ id: "eval-1" });
    mockTransactionClient.evaluation.findUnique.mockResolvedValue({});

    await evaluationService.createEvaluation(
      {
        title: "T",
        duration: 10,
        status: "DRAFT",
        questions: [
          {
            statement: "Q1",
            type: "LONG_TEXT",
            points: 5,
            criteria: [
              { label: "", points: 2 },
              { label: "Valide", points: 0 },
              { label: "Aussi valide", points: 3 },
            ],
          },
        ],
      },
      "user-1"
    );

    const createArgs = mockTransactionClient.evaluation.create.mock.calls[0][0];
    const criteria = createArgs.data.questions.create[0].criteria.create;

    expect(criteria).toEqual([
      { label: "Aussi valide", points: 3, position: 0 },
    ]);
  });
});

describe("getEvaluations / getEvaluationById", () => {
  it("liste les évaluations d'un enseignant", async () => {
    prisma.evaluation.findMany.mockResolvedValue([{ id: "eval-1" }]);

    const result = await evaluationService.getEvaluations("user-1");

    expect(prisma.evaluation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } })
    );
    expect(result).toMatchObject([{ id: "eval-1" }]);
  });

  it("ne charge pour la liste ni les questions, ni les choix, ni les tentatives (forme allégée)", async () => {
    prisma.evaluation.findMany.mockResolvedValue([]);

    await evaluationService.getEvaluations("user-1");

    const { include } = prisma.evaluation.findMany.mock.calls[0][0];

    expect(include.questions).toBeUndefined();
    expect(include.user).toBeUndefined();
    expect(include.publications.select).toMatchObject({
      id: true,
      code: true,
      status: true,
      _count: { select: { attempts: true } },
    });
    // Ni tentatives ni élèves dans les publications de la liste.
    expect(include.publications.select.attempts).toBeUndefined();
    expect(include.publications.include).toBeUndefined();
    expect(include._count.select).toEqual({ questions: true, publications: true });
  });

  it("ajoute le total des tentatives de toutes les publications dans _count.attempts", async () => {
    prisma.evaluation.findMany.mockResolvedValue([
      {
        id: "eval-1",
        _count: { questions: 5, publications: 2 },
        publications: [{ _count: { attempts: 3 } }, { _count: { attempts: 4 } }],
      },
      {
        id: "eval-2",
        _count: { questions: 1, publications: 0 },
        publications: [],
      },
    ]);

    const result = await evaluationService.getEvaluations("user-1");

    expect(result[0]._count).toEqual({ questions: 5, publications: 2, attempts: 7 });
    expect(result[1]._count).toEqual({ questions: 1, publications: 0, attempts: 0 });
  });

  it("renvoie null si l'évaluation n'appartient pas à l'enseignant", async () => {
    prisma.evaluation.findFirst.mockResolvedValue(null);

    const result = await evaluationService.getEvaluationById(
      "eval-1",
      "user-1"
    );

    expect(result).toBeNull();
  });
});

describe("updateEvaluation", () => {
  it("renvoie null si l'évaluation n'existe pas ou n'appartient pas à l'enseignant", async () => {
    mockTransactionClient.evaluation.findFirst.mockResolvedValue(null);

    const result = await evaluationService.updateEvaluation(
      "eval-1",
      "user-1",
      { title: "T", duration: 10, status: "DRAFT" }
    );

    expect(result).toBeNull();
    expect(mockTransactionClient.evaluation.update).not.toHaveBeenCalled();
  });

  it("supprime puis recrée les questions quand elles sont fournies", async () => {
    mockTransactionClient.evaluation.findFirst.mockResolvedValue({
      id: "eval-1",
    });
    mockTransactionClient.evaluation.update.mockResolvedValue({
      id: "eval-1",
      status: "DRAFT",
    });
    mockTransactionClient.evaluation.findUnique.mockResolvedValue({
      id: "eval-1",
    });

    await evaluationService.updateEvaluation("eval-1", "user-1", {
      title: "T",
      duration: 10,
      status: "DRAFT",
      questions: [{ statement: "Q1", type: "SHORT_TEXT", correctAnswer: "" }],
    });

    expect(mockTransactionClient.question.deleteMany).toHaveBeenCalledWith({
      where: { evaluationId: "eval-1" },
    });
    expect(
      mockTransactionClient.evaluation.update.mock.calls[0][0].data.questions
    ).toBeDefined();
  });

  it("ne touche pas aux questions existantes quand elles ne sont pas fournies", async () => {
    mockTransactionClient.evaluation.findFirst.mockResolvedValue({
      id: "eval-1",
    });
    mockTransactionClient.evaluation.update.mockResolvedValue({
      id: "eval-1",
      status: "DRAFT",
    });
    mockTransactionClient.evaluation.findUnique.mockResolvedValue({
      id: "eval-1",
    });

    await evaluationService.updateEvaluation("eval-1", "user-1", {
      title: "T",
      duration: 10,
      status: "DRAFT",
    });

    expect(mockTransactionClient.question.deleteMany).not.toHaveBeenCalled();
    expect(
      mockTransactionClient.evaluation.update.mock.calls[0][0].data.questions
    ).toBeUndefined();
  });

  it("désactive les publications actives quand le statut n'est plus ACTIVE", async () => {
    mockTransactionClient.evaluation.findFirst.mockResolvedValue({
      id: "eval-1",
    });
    mockTransactionClient.evaluation.update.mockResolvedValue({
      id: "eval-1",
      status: "DISABLED",
    });
    mockTransactionClient.evaluation.findUnique.mockResolvedValue({
      id: "eval-1",
    });

    await evaluationService.updateEvaluation("eval-1", "user-1", {
      title: "T",
      duration: 10,
      status: "DISABLED",
    });

    expect(mockTransactionClient.publication.updateMany).toHaveBeenCalledWith({
      where: { evaluationId: "eval-1", status: "ACTIVE" },
      data: { status: "DISABLED" },
    });
  });

  it("réactive une publication existante plutôt que d'en créer une nouvelle", async () => {
    mockTransactionClient.evaluation.findFirst.mockResolvedValue({
      id: "eval-1",
    });
    mockTransactionClient.evaluation.update.mockResolvedValue({
      id: "eval-1",
      status: "ACTIVE",
      duration: 45,
    });
    mockTransactionClient.evaluation.findUnique.mockResolvedValue({
      id: "eval-1",
    });
    mockTransactionClient.publication.findFirst.mockResolvedValue({
      id: "pub-1",
      status: "DISABLED",
      duration: 45,
    });

    await evaluationService.updateEvaluation("eval-1", "user-1", {
      title: "T",
      duration: 45,
      status: "ACTIVE",
    });

    expect(mockTransactionClient.publication.create).not.toHaveBeenCalled();
    expect(mockTransactionClient.publication.update).toHaveBeenCalledWith({
      where: { id: "pub-1" },
      data: { status: "ACTIVE" },
    });
  });

  it("synchronise la durée de la publication existante avec celle de l'évaluation", async () => {
    mockTransactionClient.evaluation.findFirst.mockResolvedValue({
      id: "eval-1",
    });
    mockTransactionClient.evaluation.update.mockResolvedValue({
      id: "eval-1",
      status: "ACTIVE",
      duration: 90,
    });
    mockTransactionClient.evaluation.findUnique.mockResolvedValue({
      id: "eval-1",
    });
    mockTransactionClient.publication.findFirst.mockResolvedValue({
      id: "pub-1",
      status: "ACTIVE",
      duration: 45,
    });

    await evaluationService.updateEvaluation("eval-1", "user-1", {
      title: "T",
      duration: 90,
      status: "ACTIVE",
    });

    expect(mockTransactionClient.publication.update).toHaveBeenCalledWith({
      where: { id: "pub-1" },
      data: { duration: 90 },
    });
  });
});

describe("deleteEvaluation", () => {
  it("renvoie null si l'évaluation n'appartient pas à l'enseignant", async () => {
    prisma.evaluation.findFirst.mockResolvedValue(null);

    const result = await evaluationService.deleteEvaluation(
      "eval-1",
      "user-1"
    );

    expect(result).toBeNull();
    expect(prisma.evaluation.delete).not.toHaveBeenCalled();
  });

  it("supprime l'évaluation quand elle appartient à l'enseignant", async () => {
    prisma.evaluation.findFirst.mockResolvedValue({ id: "eval-1" });
    prisma.evaluation.delete.mockResolvedValue({ id: "eval-1" });

    const result = await evaluationService.deleteEvaluation(
      "eval-1",
      "user-1"
    );

    expect(prisma.evaluation.delete).toHaveBeenCalledWith({
      where: { id: "eval-1" },
    });
    expect(result).toEqual({ id: "eval-1" });
  });
});

describe("updateEvaluationStatus", () => {
  it("renvoie null si l'évaluation n'appartient pas à l'enseignant", async () => {
    mockTransactionClient.evaluation.findFirst.mockResolvedValue(null);

    const result = await evaluationService.updateEvaluationStatus(
      "eval-1",
      "user-1",
      "ACTIVE"
    );

    expect(result).toBeNull();
    expect(mockTransactionClient.evaluation.update).not.toHaveBeenCalled();
  });

  it("crée une publication en passant le statut à ACTIVE", async () => {
    mockTransactionClient.evaluation.findFirst.mockResolvedValue({
      id: "eval-1",
    });
    mockTransactionClient.evaluation.update.mockResolvedValue({
      id: "eval-1",
      status: "ACTIVE",
      duration: 30,
      title: "Titre",
    });
    mockTransactionClient.evaluation.findUnique.mockResolvedValue({
      id: "eval-1",
    });
    mockTransactionClient.publication.findFirst.mockResolvedValue(null);

    await evaluationService.updateEvaluationStatus(
      "eval-1",
      "user-1",
      "ACTIVE"
    );

    expect(mockTransactionClient.publication.create).toHaveBeenCalledTimes(1);
  });

  it("renvoie la forme allégée de la liste (avec le total des tentatives), pas l'évaluation complète", async () => {
    mockTransactionClient.evaluation.findFirst.mockResolvedValue({ id: "eval-1" });
    mockTransactionClient.evaluation.update.mockResolvedValue({
      id: "eval-1",
      status: "DISABLED",
    });
    mockTransactionClient.evaluation.findUnique.mockResolvedValue({
      id: "eval-1",
      _count: { questions: 3, publications: 1 },
      publications: [{ _count: { attempts: 250 } }],
    });

    const result = await evaluationService.updateEvaluationStatus(
      "eval-1",
      "user-1",
      "DISABLED"
    );

    const { include } = mockTransactionClient.evaluation.findUnique.mock.calls[0][0];

    expect(include.questions).toBeUndefined();
    expect(include.publications.select.attempts).toBeUndefined();
    expect(result._count.attempts).toBe(250);
  });
});

describe("getParticipantsByEvaluation", () => {
  const attempt = (id, evaluationId, evaluationTitle, startedAt) => ({
    id,
    startedAt: new Date(startedAt),
    status: "SUBMITTED",
    exitCount: 0,
    resultsPublished: false,
    student: { firstName: "Ada", lastName: "L", email: `${id}@x.co` },
    publication: { evaluation: { id: evaluationId, title: evaluationTitle } },
  });

  it("ne sélectionne que les champs affichés et filtre sur l'enseignant", async () => {
    prisma.attempt.findMany.mockResolvedValue([]);

    await evaluationService.getParticipantsByEvaluation("user-1");

    const args = prisma.attempt.findMany.mock.calls[0][0];

    expect(args.where).toEqual({
      publication: { evaluation: { userId: "user-1" } },
    });
    expect(args.orderBy).toEqual({ startedAt: "desc" });
    expect(args.include).toBeUndefined();
    expect(Object.keys(args.select).sort()).toEqual(
      [
        "exitCount",
        "id",
        "publication",
        "resultsPublished",
        "startedAt",
        "status",
        "student",
      ].sort()
    );
    // Ni réponses, ni questions.
    expect(args.select.answers).toBeUndefined();
  });

  it("groupe par évaluation, tentatives les plus récentes d'abord, groupes ordonnés par leur tentative la plus récente", async () => {
    // Déjà triées par startedAt décroissant, comme le fait la requête.
    prisma.attempt.findMany.mockResolvedValue([
      attempt("a1", "eval-B", "Éval B", "2026-09-26T10:00:00Z"),
      attempt("a2", "eval-A", "Éval A", "2026-09-26T09:00:00Z"),
      attempt("a3", "eval-B", "Éval B", "2026-09-26T08:00:00Z"),
      attempt("a4", "eval-A", "Éval A", "2026-09-25T09:00:00Z"),
    ]);

    const groups = await evaluationService.getParticipantsByEvaluation("user-1");

    expect(groups.map((group) => group.evaluationId)).toEqual(["eval-B", "eval-A"]);
    expect(groups[0]).toMatchObject({ evaluationTitle: "Éval B" });
    expect(groups[0].attempts.map((a) => a.id)).toEqual(["a1", "a3"]);
    expect(groups[1].attempts.map((a) => a.id)).toEqual(["a2", "a4"]);
  });

  it("n'expose pas l'évaluation imbriquée dans chaque tentative", async () => {
    prisma.attempt.findMany.mockResolvedValue([
      attempt("a1", "eval-A", "Éval A", "2026-09-26T10:00:00Z"),
    ]);

    const [group] = await evaluationService.getParticipantsByEvaluation("user-1");

    expect(group.attempts[0]).not.toHaveProperty("publication");
    expect(group.attempts[0].student.email).toBe("a1@x.co");
  });

  it("renvoie une liste vide quand l'enseignant n'a aucun participant", async () => {
    prisma.attempt.findMany.mockResolvedValue([]);

    expect(await evaluationService.getParticipantsByEvaluation("user-1")).toEqual([]);
  });
});

describe("duplicateEvaluation", () => {
  it("renvoie null si l'évaluation source n'appartient pas à l'enseignant", async () => {
    prisma.evaluation.findFirst.mockResolvedValue(null);

    const result = await evaluationService.duplicateEvaluation(
      "eval-1",
      "user-1"
    );

    expect(result).toBeNull();
    expect(prisma.evaluation.create).not.toHaveBeenCalled();
  });

  it("duplique l'évaluation en DRAFT avec un titre suffixé, sans copier le statut source", async () => {
    prisma.evaluation.findFirst.mockResolvedValue({
      id: "eval-1",
      title: "Original",
      description: "Desc",
      instructions: "Instr",
      duration: 30,
      contentType: "EVALUATION",
      type: "CLASSIC",
      status: "ACTIVE",
      questions: [
        {
          statement: "Q1",
          type: "QCM",
          points: 2,
          correctAnswer: "4",
          position: 0,
          choices: [{ text: "4", correct: true, position: 0 }],
          criteria: [{ label: "Exactitude", points: 2, position: 0 }],
        },
      ],
    });
    prisma.evaluation.create.mockResolvedValue({ id: "eval-2" });

    const result = await evaluationService.duplicateEvaluation(
      "eval-1",
      "user-1"
    );

    const createArgs = prisma.evaluation.create.mock.calls[0][0];

    expect(createArgs.data.title).toBe("Original — Copie");
    expect(createArgs.data.status).toBe("DRAFT");
    expect(createArgs.data.userId).toBe("user-1");
    expect(createArgs.data.questions.create[0].statement).toBe("Q1");
    expect(createArgs.data.questions.create[0].criteria.create).toEqual([
      { label: "Exactitude", points: 2, position: 0 },
    ]);
    // Réponse au format de la liste (allégé), avec le total des tentatives.
    expect(createArgs.include.questions).toBeUndefined();
    expect(result).toMatchObject({ id: "eval-2", _count: { attempts: 0 } });
  });
});
