jest.mock("../ai.service", () => ({
  askAI: jest.fn(),
}));

const { askAI } = require("../ai.service");
const { gradeAnswerWithAI } = require("../grading.service");

beforeEach(() => {
  jest.clearAllMocks();
});

function mockAiJsonResponse(payload) {
  askAI.mockResolvedValue(JSON.stringify(payload));
}

describe("gradeAnswerWithAI", () => {
  const question = {
    statement: "Explique la photosynthèse.",
    correctAnswer: null,
    points: 5,
  };

  it("renvoie le score et le feedback bornés par le barème", async () => {
    mockAiJsonResponse({ score: 4, feedback: "Bonne réponse." });

    const result = await gradeAnswerWithAI(question, "Une réponse.");

    expect(result).toEqual({ score: 4, feedback: "Bonne réponse." });
  });

  it("plafonne un score renvoyé au-dessus du barème", async () => {
    mockAiJsonResponse({ score: 99, feedback: "Excellent." });

    const result = await gradeAnswerWithAI(question, "Une réponse.");

    expect(result.score).toBe(5);
  });

  it("rejette avec une erreur 422 si le JSON est invalide", async () => {
    askAI.mockResolvedValue("pas du json");

    await expect(gradeAnswerWithAI(question, "Une réponse.")).rejects.toMatchObject({
      status: 422,
    });
  });

  it("n'inclut aucune correction précédente dans le prompt par défaut", async () => {
    mockAiJsonResponse({ score: 3, feedback: "Correct." });

    await gradeAnswerWithAI(question, "Une réponse.");

    const [prompt] = askAI.mock.calls[0];

    expect(prompt).toContain(
      "Aucune autre question déjà corrigée sur cette copie."
    );
  });

  it("inclut le résumé des corrections précédentes dans le prompt pour rester cohérent", async () => {
    mockAiJsonResponse({ score: 3, feedback: "Correct." });

    const priorGrading = [
      {
        statement: "Qu'est-ce que la mitose ?",
        points: 4,
        textAnswer: "La division cellulaire.",
        score: 3,
      },
    ];

    await gradeAnswerWithAI(question, "Une réponse.", priorGrading);

    const [prompt] = askAI.mock.calls[0];

    expect(prompt).toContain("Qu'est-ce que la mitose ?");
    expect(prompt).toContain("3 / 4");
  });
});
