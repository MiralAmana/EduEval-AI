const request = require("supertest");

const app = require("../../src/app");
const prisma = require("../../src/lib/prisma");
const { cleanDatabase } = require("./dbCleanup");

beforeAll(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}@example.com`;
}

describe("Parcours complet : création, passage, correction, publication", () => {
  let teacherToken;
  let evaluationId;
  let publicationCode;
  let qcmQuestionId;
  let longTextQuestionId;
  let correctChoiceId;
  let attemptId;

  it("un enseignant crée un compte", async () => {
    const response = await request(app).post("/api/auth/register").send({
      firstName: "Ada",
      lastName: "Lovelace",
      email: uniqueEmail("teacher"),
      password: "motdepasse123",
    });

    expect(response.status).toBe(201);
    expect(response.body.token).toEqual(expect.any(String));

    teacherToken = response.body.token;
  });

  it("l'enseignant crée une évaluation active (QCM + réponse longue)", async () => {
    const response = await request(app)
      .post("/api/evaluations")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        title: "Contrôle d'intégration",
        duration: 30,
        status: "ACTIVE",
        questions: [
          {
            statement: "2 + 2 ?",
            type: "QCM",
            points: 2,
            correctAnswer: "4",
            choices: ["3", "4"],
          },
          {
            statement: "Explique la photosynthèse.",
            type: "LONG_TEXT",
            points: 3,
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.publications).toHaveLength(1);
    expect(response.body.publications[0].status).toBe("ACTIVE");
    expect(response.body.publications[0].code).toEqual(expect.any(String));

    evaluationId = response.body.id;
    publicationCode = response.body.publications[0].code;

    const qcmQuestion = response.body.questions.find(
      (question) => question.type === "QCM"
    );
    const longTextQuestion = response.body.questions.find(
      (question) => question.type === "LONG_TEXT"
    );

    qcmQuestionId = qcmQuestion.id;
    longTextQuestionId = longTextQuestion.id;
    correctChoiceId = qcmQuestion.choices.find(
      (choice) => choice.text === "4"
    ).id;
  });

  it("un étudiant rejoint avec le code, sans compte", async () => {
    const response = await request(app).post("/api/attempts/join").send({
      code: publicationCode,
      firstName: "Grace",
      lastName: "Hopper",
      email: uniqueEmail("student"),
    });

    expect(response.status).toBe(201);
    expect(response.body.attempt.status).toBe("IN_PROGRESS");
    expect(response.body.questions).toHaveLength(2);

    // Le corrigé ne doit jamais fuiter vers l'étudiant.
    const qcmQuestion = response.body.questions.find(
      (question) => question.id === qcmQuestionId
    );
    expect(
      qcmQuestion.choices.some((choice) => "correct" in choice)
    ).toBe(false);

    attemptId = response.body.attempt.id;
  });

  it("l'étudiant répond au QCM (autosave)", async () => {
    const response = await request(app)
      .put(`/api/attempts/${attemptId}/answers/${qcmQuestionId}`)
      .send({ textAnswer: correctChoiceId });

    expect(response.status).toBe(200);

    const answeredQuestion = response.body.questions.find(
      (question) => question.id === qcmQuestionId
    );
    expect(answeredQuestion.answer.textAnswer).toBe(correctChoiceId);
  });

  it("l'étudiant répond à la question longue (autosave)", async () => {
    const response = await request(app)
      .put(`/api/attempts/${attemptId}/answers/${longTextQuestionId}`)
      .send({ textAnswer: "La photosynthèse transforme la lumière en énergie." });

    expect(response.status).toBe(200);
  });

  it("l'étudiant soumet : le QCM est noté automatiquement, le score reste caché", async () => {
    const response = await request(app).post(
      `/api/attempts/${attemptId}/submit`
    );

    expect(response.status).toBe(200);
    expect(response.body.attempt.status).toBe("SUBMITTED");
    // La copie contient une question longue non-QCM : pas de
    // révélation automatique de la note tant que l'enseignant n'a
    // pas publié les résultats.
    expect(response.body.attempt.resultsPublished).toBe(false);
    expect(response.body.attempt.score).toBeNull();
  });

  it("l'enseignant voit le QCM déjà noté et la question longue à corriger", async () => {
    const response = await request(app)
      .get(`/api/attempts/${attemptId}/review`)
      .set("Authorization", `Bearer ${teacherToken}`);

    expect(response.status).toBe(200);

    const qcmAnswer = response.body.questions.find(
      (question) => question.id === qcmQuestionId
    ).answer;
    const longTextAnswer = response.body.questions.find(
      (question) => question.id === longTextQuestionId
    ).answer;

    expect(qcmAnswer.score).toBe(2);
    expect(longTextAnswer.score).toBeNull();
  });

  it("l'enseignant note manuellement la question longue", async () => {
    const response = await request(app)
      .put(`/api/attempts/${attemptId}/answers/${longTextQuestionId}/grade`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ score: 3, feedback: "Bonne réponse, bien structurée." });

    expect(response.status).toBe(200);
    expect(response.body.attempt.score).toBe(5);
  });

  it("l'étudiant ne voit toujours pas sa note avant publication", async () => {
    const response = await request(app).get(`/api/attempts/${attemptId}`);

    expect(response.status).toBe(200);
    expect(response.body.attempt.score).toBeNull();
  });

  it("l'enseignant publie les résultats, l'étudiant voit alors sa note complète", async () => {
    const publishResponse = await request(app)
      .post(`/api/attempts/${attemptId}/publish`)
      .set("Authorization", `Bearer ${teacherToken}`);

    expect(publishResponse.status).toBe(200);

    const studentResponse = await request(app).get(
      `/api/attempts/${attemptId}`
    );

    expect(studentResponse.status).toBe(200);
    expect(studentResponse.body.attempt.resultsPublished).toBe(true);
    expect(studentResponse.body.attempt.score).toBe(5);
  });

  it("un autre enseignant ne peut pas accéder à la copie", async () => {
    const otherTeacher = await request(app).post("/api/auth/register").send({
      firstName: "Autre",
      lastName: "Prof",
      email: uniqueEmail("other-teacher"),
      password: "motdepasse123",
    });

    const response = await request(app)
      .get(`/api/attempts/${attemptId}/review`)
      .set("Authorization", `Bearer ${otherTeacher.body.token}`);

    expect(response.status).toBe(404);
  });
});

describe("Cas limites", () => {
  it("rejette un code de publication inconnu", async () => {
    const response = await request(app).post("/api/attempts/join").send({
      code: "ZZZZZZ",
      firstName: "Test",
      lastName: "Test",
      email: uniqueEmail("unknown-code"),
    });

    expect(response.status).toBe(404);
  });

  it("rejette une connexion avec un mauvais mot de passe", async () => {
    const email = uniqueEmail("login-test");

    await request(app).post("/api/auth/register").send({
      firstName: "Login",
      lastName: "Test",
      email,
      password: "bonmotdepasse",
    });

    const response = await request(app).post("/api/auth/login").send({
      email,
      password: "mauvaismotdepasse",
    });

    expect(response.status).toBe(401);
  });

  it("empêche de modifier une réponse après soumission", async () => {
    const teacher = await request(app).post("/api/auth/register").send({
      firstName: "Prof",
      lastName: "Fermé",
      email: uniqueEmail("closed-teacher"),
      password: "motdepasse123",
    });

    const evaluation = await request(app)
      .post("/api/evaluations")
      .set("Authorization", `Bearer ${teacher.body.token}`)
      .send({
        title: "Éval fermée",
        duration: 30,
        status: "ACTIVE",
        questions: [
          { statement: "Q1", type: "SHORT_TEXT", points: 1, correctAnswer: "ok" },
        ],
      });

    const code = evaluation.body.publications[0].code;
    const questionId = evaluation.body.questions[0].id;

    const join = await request(app).post("/api/attempts/join").send({
      code,
      firstName: "Etu",
      lastName: "Rapide",
      email: uniqueEmail("closed-student"),
    });

    const attemptIdForThisTest = join.body.attempt.id;

    await request(app)
      .post(`/api/attempts/${attemptIdForThisTest}/submit`)
      .expect(200);

    const lateAnswer = await request(app)
      .put(`/api/attempts/${attemptIdForThisTest}/answers/${questionId}`)
      .send({ textAnswer: "trop tard" });

    expect(lateAnswer.status).toBe(409);
  });
});

describe("Barème détaillé (critères de correction)", () => {
  it("crée les critères avec la question, les note individuellement, et le total en découle", async () => {
    const teacher = await request(app).post("/api/auth/register").send({
      firstName: "Rubrique",
      lastName: "Prof",
      email: uniqueEmail("rubric-teacher"),
      password: "motdepasse123",
    });
    const teacherToken = teacher.body.token;

    const evaluation = await request(app)
      .post("/api/evaluations")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        title: "Éval avec barème",
        duration: 30,
        status: "ACTIVE",
        questions: [
          {
            statement: "Explique la photosynthèse.",
            type: "LONG_TEXT",
            points: 5,
            criteria: [
              { label: "Clarté", points: 2 },
              { label: "Exactitude", points: 3 },
            ],
          },
        ],
      });

    expect(evaluation.status).toBe(201);

    const question = evaluation.body.questions[0];

    expect(question.criteria).toHaveLength(2);

    const clarteId = question.criteria.find((c) => c.label === "Clarté").id;
    const exactitudeId = question.criteria.find(
      (c) => c.label === "Exactitude"
    ).id;

    const code = evaluation.body.publications[0].code;

    const join = await request(app).post("/api/attempts/join").send({
      code,
      firstName: "Etu",
      lastName: "Bareme",
      email: uniqueEmail("rubric-student"),
    });

    // Le barème est aussi visible côté étudiant (transparence), sans
    // fuite d'information sensible (pas de bonne réponse pour ce type
    // de question de toute façon).
    const joinQuestion = join.body.questions[0];
    expect(joinQuestion.criteria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Clarté", points: 2 }),
        expect.objectContaining({ label: "Exactitude", points: 3 }),
      ])
    );

    const attemptId = join.body.attempt.id;

    await request(app)
      .put(`/api/attempts/${attemptId}/answers/${question.id}`)
      .send({ textAnswer: "La lumière devient de l'énergie chimique." })
      .expect(200);

    await request(app).post(`/api/attempts/${attemptId}/submit`).expect(200);

    const grade = await request(app)
      .put(`/api/attempts/${attemptId}/answers/${question.id}/grade`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        criterionScores: [
          { criterionId: clarteId, pointsAwarded: 2 },
          { criterionId: exactitudeId, pointsAwarded: 1 },
        ],
      });

    expect(grade.status).toBe(200);
    expect(grade.body.attempt.score).toBe(3);

    const gradedQuestion = grade.body.questions.find(
      (q) => q.id === question.id
    );
    expect(gradedQuestion.answer.score).toBe(3);
    expect(gradedQuestion.answer.criterionScores).toEqual(
      expect.arrayContaining([
        { criterionId: clarteId, pointsAwarded: 2 },
        { criterionId: exactitudeId, pointsAwarded: 1 },
      ])
    );

    // Question-par-question doit aussi refléter la même note.
    const byQuestion = await request(app)
      .get(`/api/evaluations/${evaluation.body.id}/questions/${question.id}/answers`)
      .set("Authorization", `Bearer ${teacherToken}`);

    expect(byQuestion.status).toBe(200);
    expect(byQuestion.body.answers[0].score).toBe(3);
    expect(byQuestion.body.answers[0].criterionScores).toEqual(
      expect.arrayContaining([
        { criterionId: clarteId, pointsAwarded: 2 },
        { criterionId: exactitudeId, pointsAwarded: 1 },
      ])
    );

    // Publier révèle enfin le détail par critère à l'étudiant.
    await request(app)
      .post(`/api/attempts/${attemptId}/publish`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .expect(200);

    const studentView = await request(app).get(
      `/api/attempts/${attemptId}`
    );

    const studentQuestion = studentView.body.questions.find(
      (q) => q.id === question.id
    );
    expect(studentQuestion.answer.score).toBe(3);
    expect(studentQuestion.answer.criterionScores).toEqual(
      expect.arrayContaining([
        { criterionId: clarteId, pointsAwarded: 2 },
        { criterionId: exactitudeId, pointsAwarded: 1 },
      ])
    );
  });

  it("plafonne chaque critère à son maximum et rejette une note globale incohérente avec le barème", async () => {
    const teacher = await request(app).post("/api/auth/register").send({
      firstName: "Rubrique2",
      lastName: "Prof",
      email: uniqueEmail("rubric-teacher-2"),
      password: "motdepasse123",
    });
    const teacherToken = teacher.body.token;

    const evaluation = await request(app)
      .post("/api/evaluations")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        title: "Éval avec barème 2",
        duration: 30,
        status: "ACTIVE",
        questions: [
          {
            statement: "Q1",
            type: "SHORT_TEXT",
            points: 4,
            criteria: [{ label: "Seul critère", points: 4 }],
          },
        ],
      });

    const question = evaluation.body.questions[0];
    const criterionId = question.criteria[0].id;
    const code = evaluation.body.publications[0].code;

    const join = await request(app).post("/api/attempts/join").send({
      code,
      firstName: "Etu",
      lastName: "Plafond",
      email: uniqueEmail("rubric-student-2"),
    });
    const attemptId = join.body.attempt.id;

    await request(app).post(`/api/attempts/${attemptId}/submit`).expect(200);

    const grade = await request(app)
      .put(`/api/attempts/${attemptId}/answers/${question.id}/grade`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        criterionScores: [{ criterionId, pointsAwarded: 999 }],
      });

    expect(grade.status).toBe(200);

    const gradedQuestion = grade.body.questions.find(
      (q) => q.id === question.id
    );
    // Plafonné à 4 (le maximum du critère), pas 999.
    expect(gradedQuestion.answer.score).toBe(4);
  });
});
