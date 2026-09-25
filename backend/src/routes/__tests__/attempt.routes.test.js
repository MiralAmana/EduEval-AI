const request = require("supertest");

jest.mock("../../controllers/attempt.controller", () => {
  const ok = (req, res) => res.status(200).json({ ok: true });

  return {
    join: (req, res) => res.status(201).json({ ok: true }),
    getOne: (req, res) =>
      req.params.id.startsWith("missing")
        ? res.status(404).json({ message: "Tentative introuvable." })
        : res.json({ ok: true }),
    saveAnswer: ok,
    saveFileAnswer: ok,
    exit: ok,
    submit: ok,
    review: ok,
    gradeAnswer: ok,
    gradeAnswerWithAi: ok,
    publish: ok,
    downloadAnswerFile: ok,
    previewAnswerFile: ok,
  };
});

jest.mock("../../middleware/auth.middleware", () => ({
  requireAuth: (req, res, next) => next(),
}));

jest.mock("../../services/attempt.service", () => ({
  getAttemptEvaluationType: jest.fn(),
}));

const ORIGINAL_ENV = { ...process.env };
let server;

// Chaque test repart de limiteurs neufs (leurs compteurs vivent en mémoire
// dans le module de routes) ; toutes les requêtes viennent de la même IP.
function startApp() {
  let app;

  jest.isolateModules(() => {
    const express = require("express");
    const router = require("../attempt.routes");

    app = express();
    app.use(express.json());
    app.use("/api/attempts", router);
  });

  server = app.listen(0);

  return request(server);
}

afterEach(async () => {
  process.env = { ...ORIGINAL_ENV };

  if (server) {
    await new Promise((resolve) => server.close(resolve));
    server = null;
  }
});

describe("limiteurs des routes élève", () => {
  it("laisse passer une classe de 250 élèves derrière une même IP (entrée, lecture, sauvegarde)", async () => {
    const api = startApp();
    const statuses = new Set();

    for (let i = 0; i < 250; i += 1) {
      const join = await api.post("/api/attempts/join").send({});
      const read = await api.get(`/api/attempts/attempt-${i}`);
      const save = await api
        .put(`/api/attempts/attempt-${i}/answers/q1`)
        .send({ textAnswer: "x" });

      statuses.add(`${join.status}/${read.status}/${save.status}`);
    }

    expect([...statuses]).toEqual(["201/200/200"]);
  }, 60000);

  it("limite les actions par tentative, sans affecter les autres élèves de la même IP", async () => {
    const api = startApp();

    for (let i = 0; i < 120; i += 1) {
      const response = await api
        .put("/api/attempts/attempt-spam/answers/q1")
        .send({ textAnswer: "x" });

      expect(response.status).toBe(200);
    }

    const blocked = await api
      .put("/api/attempts/attempt-spam/answers/q1")
      .send({ textAnswer: "x" });
    const other = await api
      .put("/api/attempts/attempt-autre/answers/q1")
      .send({ textAnswer: "x" });

    expect(blocked.status).toBe(429);
    expect(other.status).toBe(200);
  }, 30000);

  it("plafonne les entrées par IP selon JOIN_RATE_LIMIT_PER_IP", async () => {
    process.env.JOIN_RATE_LIMIT_PER_IP = "5";
    const api = startApp();

    for (let i = 0; i < 5; i += 1) {
      expect((await api.post("/api/attempts/join").send({})).status).toBe(201);
    }

    expect((await api.post("/api/attempts/join").send({})).status).toBe(429);
  });

  it("bloque une IP qui sonde des identifiants de tentative inconnus (404)", async () => {
    const api = startApp();

    for (let i = 0; i < 600; i += 1) {
      const response = await api.get(`/api/attempts/missing-${i}`);

      expect(response.status).toBe(404);
    }

    const probe = await api.get("/api/attempts/missing-suite");

    expect(probe.status).toBe(429);
  }, 60000);

  it("limite les dépôts de fichiers à 10 par tentative", async () => {
    const api = startApp();

    for (let i = 0; i < 10; i += 1) {
      const response = await api.post(
        "/api/attempts/attempt-fichier/answers/q1/file"
      );

      expect(response.status).toBe(200);
    }

    const blocked = await api.post(
      "/api/attempts/attempt-fichier/answers/q1/file"
    );

    expect(blocked.status).toBe(429);
  });
});
