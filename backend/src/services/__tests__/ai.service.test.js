const mockPost = jest.fn();

jest.mock("axios", () => ({
  create: jest.fn(() => ({ post: mockPost })),
}));

const { askAI } = require("../ai.service");

const ORIGINAL_ENV = { ...process.env };

function okResponse(content) {
  return { data: { choices: [{ message: { content } }] } };
}

function httpError(status) {
  const error = new Error(`HTTP ${status}`);
  error.response = { status };
  return error;
}

beforeEach(() => {
  mockPost.mockReset();
  process.env = { ...ORIGINAL_ENV };
  process.env.GROQ_API_KEY = "test-key";
  // Backoff instantané pour ne pas ralentir les tests.
  process.env.GROQ_RETRY_BASE_DELAY_MS = "0";
  delete process.env.GROQ_MODEL;
  delete process.env.GROQ_FALLBACK_MODEL;
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("askAI", () => {
  it("rejette si GROQ_API_KEY est absente", async () => {
    delete process.env.GROQ_API_KEY;

    await expect(askAI("prompt")).rejects.toThrow(/GROQ_API_KEY/);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("renvoie le contenu de la réponse en cas de succès", async () => {
    mockPost.mockResolvedValue(okResponse("  Bonjour  "));

    const result = await askAI("prompt");

    expect(result).toBe("Bonjour");
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it("utilise le modèle par défaut si GROQ_MODEL n'est pas défini", async () => {
    mockPost.mockResolvedValue(okResponse("ok"));

    await askAI("prompt");

    const [, body] = mockPost.mock.calls[0];
    expect(body.model).toBe("llama-3.3-70b-versatile");
  });

  it("utilise GROQ_MODEL quand il est défini", async () => {
    process.env.GROQ_MODEL = "un-autre-modele";
    mockPost.mockResolvedValue(okResponse("ok"));

    await askAI("prompt");

    const [, body] = mockPost.mock.calls[0];
    expect(body.model).toBe("un-autre-modele");
  });

  it("retente sur une erreur 500 puis réussit", async () => {
    mockPost
      .mockRejectedValueOnce(httpError(500))
      .mockResolvedValueOnce(okResponse("ok après retry"));

    const result = await askAI("prompt");

    expect(result).toBe("ok après retry");
    expect(mockPost).toHaveBeenCalledTimes(2);
  });

  it("retente sur une erreur réseau (sans réponse HTTP)", async () => {
    mockPost
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(okResponse("ok"));

    const result = await askAI("prompt");

    expect(result).toBe("ok");
    expect(mockPost).toHaveBeenCalledTimes(2);
  });

  it("ne retente pas sur une erreur 400 (non transitoire)", async () => {
    mockPost.mockRejectedValue(httpError(400));

    await expect(askAI("prompt")).rejects.toThrow();
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it("abandonne après le nombre maximal de tentatives sur des erreurs transitoires", async () => {
    mockPost.mockRejectedValue(httpError(503));

    await expect(askAI("prompt")).rejects.toThrow();
    // MAX_RETRIES = 2 -> 3 tentatives au total.
    expect(mockPost).toHaveBeenCalledTimes(3);
  });

  it("bascule sur le modèle de repli si le modèle principal échoue et qu'un fallback est configuré", async () => {
    process.env.GROQ_MODEL = "modele-principal";
    process.env.GROQ_FALLBACK_MODEL = "modele-de-secours";

    // Les 3 tentatives sur le modèle principal échouent, puis le
    // fallback est tenté : on le fait réussir à sa 1ère tentative.
    mockPost.mockImplementation((url, body) => {
      if (body.model === "modele-de-secours") {
        return Promise.resolve(okResponse("réponse du fallback"));
      }
      return Promise.reject(httpError(503));
    });

    const result = await askAI("prompt");

    expect(result).toBe("réponse du fallback");

    const modelsCalled = mockPost.mock.calls.map(([, body]) => body.model);
    expect(modelsCalled.filter((model) => model === "modele-principal")).toHaveLength(3);
    expect(modelsCalled.filter((model) => model === "modele-de-secours")).toHaveLength(1);
  });

  it("ne tente pas de fallback si aucun n'est configuré", async () => {
    mockPost.mockRejectedValue(httpError(503));

    await expect(askAI("prompt")).rejects.toThrow();
    expect(mockPost).toHaveBeenCalledTimes(3);
  });
});
