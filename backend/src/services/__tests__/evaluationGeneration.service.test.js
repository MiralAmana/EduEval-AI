jest.mock("../ai.service", () => ({
  askAI: jest.fn(),
}));

const { askAI } = require("../ai.service");
const {
  generateEvaluation,
  normalizeQuestions,
  rebalancePoints,
} = require("../evaluationGeneration.service");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("normalizeQuestions", () => {
  it("retombe sur SHORT_TEXT pour un type inconnu", () => {
    const result = normalizeQuestions([
      { statement: "Q1", type: "ESSAY", points: 2 },
    ]);

    expect(result[0].type).toBe("SHORT_TEXT");
  });

  it("vide les choix pour une question non-QCM", () => {
    const result = normalizeQuestions([
      { statement: "Q1", type: "SHORT_TEXT", choices: ["a", "b"] },
    ]);

    expect(result[0].choices).toEqual([]);
  });

  it("attribue 1 point par défaut si les points sont invalides", () => {
    const result = normalizeQuestions([
      { statement: "Q1", type: "QCM", points: -5 },
    ]);

    expect(result[0].points).toBe(1);
  });
});

describe("rebalancePoints", () => {
  it("ne touche pas au barème s'il correspond déjà à la cible", () => {
    const questions = [{ points: 5 }, { points: 5 }];

    const result = rebalancePoints(questions, 10);

    expect(result.map((q) => q.points)).toEqual([5, 5]);
  });

  it("rééquilibre proportionnellement pour atteindre le barème cible", () => {
    const questions = [{ points: 1 }, { points: 1 }, { points: 1 }];

    const result = rebalancePoints(questions, 9);

    expect(result.reduce((sum, q) => sum + q.points, 0)).toBe(9);
  });

  it("corrige la dérive d'arrondi sur la dernière question", () => {
    const questions = [{ points: 1 }, { points: 1 }, { points: 1 }];

    const result = rebalancePoints(questions, 10);

    const total = result.reduce((sum, q) => sum + q.points, 0);

    expect(total).toBeCloseTo(10, 1);
  });
});

describe("generateEvaluation", () => {
  const baseParams = {
    subject: "Histoire",
    level: "Débutant",
    questionCount: 2,
    questionType: "MIXED",
    objectives: "",
    duration: 30,
    contentType: "EVALUATION",
  };

  it("retourne une évaluation normalisée à partir de la réponse IA", async () => {
    askAI.mockResolvedValue(
      JSON.stringify({
        title: "Titre",
        description: "Desc",
        instructions: "Instr",
        duration: 45,
        questions: [
          {
            statement: "Q1",
            type: "QCM",
            choices: ["A", "B"],
            correctAnswer: "A",
            points: 2,
          },
          {
            statement: "Q2",
            type: "SHORT_TEXT",
            correctAnswer: "Réponse",
            points: 3,
          },
        ],
      })
    );

    const evaluation = await generateEvaluation(baseParams);

    expect(evaluation.title).toBe("Titre");
    expect(evaluation.duration).toBe(45);
    expect(evaluation.questions).toHaveLength(2);
  });

  it("rejette avec une erreur 422 si le JSON est invalide", async () => {
    askAI.mockResolvedValue("pas du json");

    await expect(generateEvaluation(baseParams)).rejects.toMatchObject({
      status: 422,
    });
  });

  it("rejette avec une erreur 422 si aucune question n'est générée", async () => {
    askAI.mockResolvedValue(JSON.stringify({ title: "T", questions: [] }));

    await expect(generateEvaluation(baseParams)).rejects.toMatchObject({
      status: 422,
    });
  });

  it("rééquilibre le barème si totalPoints est fourni", async () => {
    askAI.mockResolvedValue(
      JSON.stringify({
        title: "Titre",
        questions: [
          { statement: "Q1", type: "QCM", points: 1 },
          { statement: "Q2", type: "SHORT_TEXT", points: 1 },
        ],
      })
    );

    const evaluation = await generateEvaluation({
      ...baseParams,
      totalPoints: 20,
    });

    const total = evaluation.questions.reduce((sum, q) => sum + q.points, 0);

    expect(total).toBe(20);
  });

  it("utilise un titre par défaut si l'IA n'en fournit pas", async () => {
    askAI.mockResolvedValue(
      JSON.stringify({
        questions: [{ statement: "Q1", type: "QCM", points: 1 }],
      })
    );

    const evaluation = await generateEvaluation(baseParams);

    expect(evaluation.title).toBe("Évaluation — Histoire");
  });
});
