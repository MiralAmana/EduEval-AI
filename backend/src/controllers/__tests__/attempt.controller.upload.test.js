jest.mock("../../services/attempt.service", () => ({
  saveFileAnswer: jest.fn(),
}));

jest.mock("node:fs/promises", () => ({
  unlink: jest.fn(),
}));

const fs = require("node:fs/promises");
const attemptService = require("../../services/attempt.service");
const controller = require("../attempt.controller");

function buildRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function buildReq(overrides = {}) {
  return {
    params: { id: "attempt-1", questionId: "q-1" },
    file: {
      path: "uploads/abc123",
      originalname: "devoir.pdf",
      mimetype: "application/pdf",
    },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  fs.unlink.mockResolvedValue(undefined);
});

describe("saveFileAnswer (contrôleur) : fichier temporaire", () => {
  it("supprime le fichier temporaire après un dépôt réussi", async () => {
    attemptService.saveFileAnswer.mockResolvedValue({ ok: true });
    const res = buildRes();

    await controller.saveFileAnswer(buildReq(), res, jest.fn());

    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(fs.unlink).toHaveBeenCalledWith("uploads/abc123");
  });

  it("supprime aussi le fichier quand le dépôt est refusé (ex. tentative déjà soumise, 409)", async () => {
    const refusal = Object.assign(new Error("Cette tentative n’est plus modifiable."), {
      status: 409,
    });
    attemptService.saveFileAnswer.mockRejectedValue(refusal);
    const next = jest.fn();

    await controller.saveFileAnswer(buildReq(), buildRes(), next);

    expect(next).toHaveBeenCalledWith(refusal);
    expect(fs.unlink).toHaveBeenCalledWith("uploads/abc123");
  });

  it("supprime aussi le fichier sur une erreur inattendue (ex. stockage indisponible)", async () => {
    attemptService.saveFileAnswer.mockRejectedValue(new Error("S3 indisponible"));

    await controller.saveFileAnswer(buildReq(), buildRes(), jest.fn());

    expect(fs.unlink).toHaveBeenCalledTimes(1);
  });

  it("ne fait pas échouer la requête si la suppression elle-même échoue", async () => {
    attemptService.saveFileAnswer.mockResolvedValue({ ok: true });
    fs.unlink.mockRejectedValue(new Error("ENOENT"));
    const res = buildRes();
    const next = jest.fn();

    await controller.saveFileAnswer(buildReq(), res, next);

    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(next).not.toHaveBeenCalled();
  });

  it("répond 400 sans rien supprimer quand aucun fichier n'a été envoyé", async () => {
    const res = buildRes();

    await controller.saveFileAnswer(buildReq({ file: undefined }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(attemptService.saveFileAnswer).not.toHaveBeenCalled();
    expect(fs.unlink).not.toHaveBeenCalled();
  });
});
