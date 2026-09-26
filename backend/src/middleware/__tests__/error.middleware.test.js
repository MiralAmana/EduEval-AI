const { errorHandler } = require("../error.middleware");

function buildRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("errorHandler", () => {
  it("renvoie 502 (et non le statut amont) pour une erreur axios venant de Groq", () => {
    const res = buildRes();
    const upstreamError = Object.assign(
      new Error("Request failed with status code 404"),
      {
        isAxiosError: true,
        status: 404,
        config: { url: "/chat/completions" },
        response: { status: 404, data: { error: { code: "model_not_found" } } },
      }
    );

    errorHandler(upstreamError, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json.mock.calls[0][0].message).not.toMatch(/status code 404/);
    expect(console.error).toHaveBeenCalledWith(
      "Erreur du service externe :",
      "/chat/completions",
      404,
      expect.stringContaining("model_not_found")
    );
  });

  it("conserve le statut et le message des erreurs applicatives", () => {
    const res = buildRes();
    const error = Object.assign(new Error("Un compte existe déjà."), {
      status: 409,
    });

    errorHandler(error, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: "Un compte existe déjà." });
  });

  it("répond 413 avec un message clair quand un fichier dépasse la taille maximale (et non un 500 en anglais)", () => {
    const res = buildRes();
    const multerError = Object.assign(new Error("File too large"), {
      name: "MulterError",
      code: "LIMIT_FILE_SIZE",
    });

    errorHandler(multerError, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({
      message: "Fichier trop volumineux (10 Mo maximum).",
    });
    expect(console.error).not.toHaveBeenCalled(); // erreur du client, pas du serveur
  });

  it("répond 400 pour les autres refus de multer", () => {
    const res = buildRes();
    const multerError = Object.assign(new Error("Unexpected field"), {
      name: "MulterError",
      code: "LIMIT_UNEXPECTED_FILE",
    });

    errorHandler(multerError, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("répond 500 par défaut", () => {
    const res = buildRes();

    errorHandler(new Error("boom"), {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
