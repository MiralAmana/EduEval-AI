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
});

describe("getEvaluations / getEvaluationById", () => {
  it("liste les évaluations d'un enseignant", async () => {
    prisma.evaluation.findMany.mockResolvedValue([{ id: "eval-1" }]);

    const result = await evaluationService.getEvaluations("user-1");

    expect(prisma.evaluation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } })
    );
    expect(result).toEqual([{ id: "eval-1" }]);
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
    expect(result).toEqual({ id: "eval-2" });
  });
});
