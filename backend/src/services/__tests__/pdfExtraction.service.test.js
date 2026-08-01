jest.mock("node:fs/promises", () => ({
  readFile: jest.fn().mockResolvedValue(Buffer.from("fake-pdf-bytes")),
}));

const mockGetText = jest.fn();
const mockDestroy = jest.fn().mockResolvedValue(undefined);

jest.mock("pdf-parse", () => ({
  PDFParse: jest.fn().mockImplementation(() => ({
    getText: mockGetText,
    destroy: mockDestroy,
  })),
}));

jest.mock("../ai.service", () => ({
  askAI: jest.fn(),
}));

const { askAI } = require("../ai.service");
const {
  extractEvaluationFromPdf,
  normalizeQuestions,
} = require("../pdfExtraction.service");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("normalizeQuestions", () => {
  it("filtre les questions sans énoncé", () => {
    const result = normalizeQuestions([
      { statement: "  ", type: "QCM", points: 1 },
      { statement: "Q2", type: "QCM", points: 1 },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].statement).toBe("Q2");
  });
});

describe("extractEvaluationFromPdf", () => {
  it("rejette avec une erreur 400 si aucun texte n'est détecté", async () => {
    mockGetText.mockResolvedValue({ text: "   ", pages: [], total: 1 });

    await expect(extractEvaluationFromPdf("/tmp/file.pdf")).rejects.toMatchObject(
      { status: 400 }
    );

    expect(mockDestroy).toHaveBeenCalled();
  });

  it("extrait les questions d'un petit PDF en un seul appel IA", async () => {
    mockGetText.mockResolvedValue({
      text: "Question 1 : ...",
      pages: [{ num: 1, text: "Question 1 : ..." }],
      total: 1,
    });

    askAI.mockResolvedValue(
      JSON.stringify({
        containsQuestions: true,
        title: "Titre",
        description: "Desc",
        duration: 30,
        questions: [
          {
            statement: "Question 1",
            type: "QCM",
            choices: ["A", "B"],
            correctAnswer: "A",
            points: 2,
          },
        ],
      })
    );

    const result = await extractEvaluationFromPdf("/tmp/file.pdf");

    expect(askAI).toHaveBeenCalledTimes(1);
    expect(result.pageCount).toBe(1);
    expect(result.evaluation.questions).toHaveLength(1);
    expect(result.evaluation.title).toBe("Titre");
  });

  it("découpe en plusieurs chunks et fusionne les questions extraites", async () => {
    const pages = [
      { num: 1, text: "a".repeat(5000) },
      { num: 2, text: "b".repeat(5000) },
    ];

    mockGetText.mockResolvedValue({
      text: pages.map((page) => page.text).join(""),
      pages,
      total: 2,
    });

    askAI
      .mockResolvedValueOnce(
        JSON.stringify({
          containsQuestions: true,
          title: "Titre du premier chunk",
          questions: [{ statement: "Q1", type: "QCM", points: 1 }],
        })
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          containsQuestions: true,
          title: "",
          questions: [{ statement: "Q2", type: "QCM", points: 1 }],
        })
      );

    const result = await extractEvaluationFromPdf("/tmp/file.pdf");

    expect(askAI).toHaveBeenCalledTimes(2);
    expect(result.evaluation.questions).toHaveLength(2);
    expect(result.evaluation.title).toBe("Titre du premier chunk");
  });

  it("rejette avec une erreur 413 si le document dépasse le nombre maximal de chunks", async () => {
    const pages = Array.from({ length: 13 }, (_, index) => ({
      num: index + 1,
      text: "x".repeat(9000),
    }));

    mockGetText.mockResolvedValue({
      text: pages.map((page) => page.text).join(""),
      pages,
      total: 13,
    });

    await expect(extractEvaluationFromPdf("/tmp/file.pdf")).rejects.toMatchObject(
      { status: 413 }
    );

    expect(askAI).not.toHaveBeenCalled();
  });

  it("rejette avec une erreur 422 si le JSON renvoyé est invalide", async () => {
    mockGetText.mockResolvedValue({
      text: "Question 1 : ...",
      pages: [{ num: 1, text: "Question 1 : ..." }],
      total: 1,
    });

    askAI.mockResolvedValue("pas du json");

    await expect(extractEvaluationFromPdf("/tmp/file.pdf")).rejects.toMatchObject(
      { status: 422 }
    );
  });

  it("rejette avec une erreur 422 si aucune question n'est identifiée", async () => {
    mockGetText.mockResolvedValue({
      text: "Un simple cours sans questions.",
      pages: [{ num: 1, text: "Un simple cours sans questions." }],
      total: 1,
    });

    askAI.mockResolvedValue(
      JSON.stringify({ containsQuestions: false, questions: [] })
    );

    await expect(extractEvaluationFromPdf("/tmp/file.pdf")).rejects.toMatchObject(
      { status: 422 }
    );
  });
});
