const fs = require("node:fs/promises");
const path = require("node:path");

const prisma = require("../lib/prisma");
const { sanitizeQuestionsForStudent } = require("../lib/sanitize");
const { gradeAnswerWithAI } = require("./grading.service");
const { sendResultsPublishedEmail } = require("./email.service");

const evaluationWithQuestionsInclude = {
  evaluation: {
    include: {
      questions: {
        orderBy: {
          position: "asc",
        },

        include: {
          choices: {
            orderBy: {
              position: "asc",
            },
          },
        },
      },
    },
  },
};

function checkPublicationIsOpen(publication) {
  const now = new Date();

  if (publication.status !== "ACTIVE") {
    const error = new Error("Cette publication n’est pas active.");
    error.status = 403;
    throw error;
  }

  if (publication.availableAt && now < new Date(publication.availableAt)) {
    const error = new Error(
      "Cette publication n’est pas encore disponible."
    );
    error.status = 403;
    throw error;
  }

  if (publication.closesAt && now > new Date(publication.closesAt)) {
    const error = new Error("Cette publication est fermée.");
    error.status = 403;
    throw error;
  }
}

/**
 * Une évaluation composée uniquement de QCM est intégralement
 * objective : la note peut être révélée à l'étudiant sans relecture
 * par l'enseignant. Toute autre question (texte, fichier) impose de
 * passer par la publication manuelle des résultats.
 */
function isPureQcm(questions) {
  return (
    questions.length > 0 &&
    questions.every((question) => question.type === "QCM")
  );
}

function gradeAnswer(question, answer) {
  if (!answer) {
    return question.type === "QCM" || question.type === "SHORT_TEXT"
      ? 0
      : null;
  }

  if (question.type === "QCM") {
    const chosenChoice = question.choices.find(
      (choice) => choice.id === answer.textAnswer
    );

    return chosenChoice?.correct ? question.points : 0;
  }

  if (question.type === "SHORT_TEXT") {
    const expected = question.correctAnswer?.trim().toLowerCase();

    if (!expected) {
      return null;
    }

    const given = answer.textAnswer?.trim().toLowerCase() || "";

    return given === expected ? question.points : 0;
  }

  return null;
}

async function gradeAttempt(attemptId, questions) {
  const answers = await prisma.answer.findMany({
    where: {
      attemptId,
    },
  });

  const answersByQuestionId = new Map(
    answers.map((answer) => [answer.questionId, answer])
  );

  let total = 0;

  for (const question of questions) {
    const answer = answersByQuestionId.get(question.id);
    const score = gradeAnswer(question, answer);

    if (answer) {
      await prisma.answer.update({
        where: {
          id: answer.id,
        },

        data: {
          score,
        },
      });
    }

    total += score || 0;
  }

  return total;
}

/**
 * Prévient l'étudiant par email dès que ses résultats deviennent
 * consultables. Une panne d'envoi ne doit jamais faire échouer la
 * soumission ou la publication elle-même.
 */
async function notifyResultsPublished(attempt, score, questions) {
  const maxScore = questions.reduce(
    (sum, question) => sum + question.points,
    0
  );

  try {
    await sendResultsPublishedEmail({
      to: attempt.student.email,
      firstName: attempt.student.firstName,
      evaluationTitle: attempt.publication.evaluation.title,
      score,
      maxScore,
    });
  } catch (error) {
    console.error(
      "Échec de l’envoi de l’email de résultats :",
      error.message
    );
  }
}

async function finalizeAttempt(attempt, status, submittedAt) {
  const questions = attempt.publication.evaluation.questions;
  const score = await gradeAttempt(attempt.id, questions);
  const resultsPublished = isPureQcm(questions);

  const updatedAttempt = await prisma.attempt.update({
    where: {
      id: attempt.id,
    },

    data: {
      status,
      submittedAt,
      score,
      resultsPublished,
    },

    include: {
      answers: true,
    },
  });

  if (resultsPublished) {
    await notifyResultsPublished(attempt, score, questions);
  }

  return updatedAttempt;
}

async function recomputeAttemptScore(attemptId, questions) {
  const answers = await prisma.answer.findMany({
    where: {
      attemptId,
    },
  });

  const answersByQuestionId = new Map(
    answers.map((answer) => [answer.questionId, answer])
  );

  const total = questions.reduce((sum, question) => {
    const answer = answersByQuestionId.get(question.id);

    return sum + (answer?.score || 0);
  }, 0);

  await prisma.attempt.update({
    where: {
      id: attemptId,
    },

    data: {
      score: total,
    },
  });
}

async function getAttemptWithContext(attemptId) {
  return prisma.attempt.findUnique({
    where: {
      id: attemptId,
    },

    include: {
      answers: true,
      student: true,
      publication: {
        include: evaluationWithQuestionsInclude,
      },
    },
  });
}

/**
 * Vérifie et applique l'expiration d'une tentative en cours dont le
 * temps est écoulé, en la notant automatiquement avec les réponses
 * déjà enregistrées.
 */
async function ensureAttemptIsCurrent(attempt) {
  if (attempt.status === "IN_PROGRESS" && new Date() >= attempt.endsAt) {
    await finalizeAttempt(attempt, "EXPIRED", attempt.endsAt);

    return getAttemptWithContext(attempt.id);
  }

  return attempt;
}

function buildStudentPayload(attempt) {
  const { evaluation } = attempt.publication;
  const revealScores =
    attempt.status !== "IN_PROGRESS" && attempt.resultsPublished;

  const answersByQuestionId = new Map(
    attempt.answers.map((answer) => [answer.questionId, answer])
  );

  const questions = sanitizeQuestionsForStudent(
    evaluation.questions
  ).map((question) => {
    const answer = answersByQuestionId.get(question.id);

    return {
      ...question,
      answer: answer
        ? {
            textAnswer: answer.textAnswer,
            filePath: answer.filePath,
            ...(revealScores ? { score: answer.score } : {}),
          }
        : null,
    };
  });

  return {
    attempt: {
      id: attempt.id,
      status: attempt.status,
      exitCount: attempt.exitCount,
      startedAt: attempt.startedAt,
      endsAt: attempt.endsAt,
      submittedAt: attempt.submittedAt,
      score: revealScores ? attempt.score : null,
      resultsPublished: attempt.resultsPublished,
    },

    evaluation: {
      title: evaluation.title,
      instructions: evaluation.instructions,
      duration: attempt.publication.duration,
    },

    questions,
  };
}

async function joinPublication({ code, firstName, lastName, email }) {
  const publication = await prisma.publication.findUnique({
    where: {
      code: String(code).trim().toUpperCase(),
    },

    include: evaluationWithQuestionsInclude,
  });

  if (!publication) {
    const error = new Error(
      "Aucune publication ne correspond à ce code."
    );
    error.status = 404;
    throw error;
  }

  checkPublicationIsOpen(publication);

  const normalizedEmail = String(email).toLowerCase().trim();

  const student = await prisma.student.upsert({
    where: {
      email: normalizedEmail,
    },

    update: {
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
    },

    create: {
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      email: normalizedEmail,
    },
  });

  let attempt = await prisma.attempt.findUnique({
    where: {
      publicationId_studentId: {
        publicationId: publication.id,
        studentId: student.id,
      },
    },

    include: {
      answers: true,
      student: true,
      publication: {
        include: evaluationWithQuestionsInclude,
      },
    },
  });

  if (!attempt) {
    attempt = await prisma.attempt.create({
      data: {
        publicationId: publication.id,
        studentId: student.id,
        endsAt: new Date(Date.now() + publication.duration * 60 * 1000),
      },

      include: {
        answers: true,
        student: true,
        publication: {
          include: evaluationWithQuestionsInclude,
        },
      },
    });
  }

  attempt = await ensureAttemptIsCurrent(attempt);

  if (attempt.status !== "IN_PROGRESS") {
    const error = new Error(
      "Cette tentative est déjà terminée et ne peut pas être reprise."
    );
    error.status = 409;
    throw error;
  }

  return buildStudentPayload(attempt);
}

async function getAttempt(attemptId) {
  let attempt = await getAttemptWithContext(attemptId);

  if (!attempt) {
    return null;
  }

  attempt = await ensureAttemptIsCurrent(attempt);

  if (
    attempt.status === "IN_PROGRESS" &&
    attempt.publication.status !== "ACTIVE"
  ) {
    const error = new Error(
      "Cette évaluation n’est plus disponible."
    );
    error.status = 403;
    throw error;
  }

  return buildStudentPayload(attempt);
}

async function requireActiveAttempt(attemptId) {
  let attempt = await getAttemptWithContext(attemptId);

  if (!attempt) {
    const error = new Error("Tentative introuvable.");
    error.status = 404;
    throw error;
  }

  attempt = await ensureAttemptIsCurrent(attempt);

  if (attempt.status !== "IN_PROGRESS") {
    const error = new Error(
      "Cette tentative n’est plus modifiable."
    );
    error.status = 409;
    throw error;
  }

  if (attempt.publication.status !== "ACTIVE") {
    const error = new Error(
      "Cette évaluation n’est plus disponible."
    );
    error.status = 403;
    throw error;
  }

  return attempt;
}

async function saveTextAnswer(attemptId, questionId, textAnswer) {
  const attempt = await requireActiveAttempt(attemptId);

  const question = attempt.publication.evaluation.questions.find(
    (item) => item.id === questionId
  );

  if (!question) {
    const error = new Error("Question introuvable pour cette évaluation.");
    error.status = 404;
    throw error;
  }

  await prisma.answer.upsert({
    where: {
      questionId_attemptId: {
        questionId,
        attemptId,
      },
    },

    update: {
      textAnswer: String(textAnswer ?? ""),
    },

    create: {
      questionId,
      attemptId,
      textAnswer: String(textAnswer ?? ""),
    },
  });

  return getAttempt(attemptId);
}

async function saveFileAnswer(attemptId, questionId, filePath, fileName) {
  const attempt = await requireActiveAttempt(attemptId);

  const question = attempt.publication.evaluation.questions.find(
    (item) => item.id === questionId
  );

  if (!question) {
    const error = new Error("Question introuvable pour cette évaluation.");
    error.status = 404;
    throw error;
  }

  const existingAnswer = attempt.answers.find(
    (answer) => answer.questionId === questionId
  );

  if (existingAnswer?.filePath) {
    await fs.unlink(existingAnswer.filePath).catch(() => {});
  }

  await prisma.answer.upsert({
    where: {
      questionId_attemptId: {
        questionId,
        attemptId,
      },
    },

    update: {
      filePath,
      fileName,
    },

    create: {
      questionId,
      attemptId,
      filePath,
      fileName,
    },
  });

  return getAttempt(attemptId);
}

async function registerExit(attemptId) {
  const attempt = await requireActiveAttempt(attemptId);

  const nextExitCount = attempt.exitCount + 1;
  const shouldBlock = nextExitCount >= 3;

  await prisma.attempt.update({
    where: {
      id: attemptId,
    },

    data: {
      exitCount: nextExitCount,
    },
  });

  if (shouldBlock) {
    const refreshedAttempt = await getAttemptWithContext(attemptId);

    await finalizeAttempt(refreshedAttempt, "BLOCKED", new Date());
  }

  return getAttempt(attemptId);
}

async function submitAttempt(attemptId) {
  const attempt = await requireActiveAttempt(attemptId);

  await finalizeAttempt(attempt, "SUBMITTED", new Date());

  return getAttempt(attemptId);
}

// --- Correction enseignant ---

async function requireAttemptOwnedByTeacher(attemptId, userId) {
  const attempt = await prisma.attempt.findFirst({
    where: {
      id: attemptId,
      publication: {
        evaluation: {
          userId,
        },
      },
    },

    include: {
      answers: true,
      student: true,
      publication: {
        include: evaluationWithQuestionsInclude,
      },
    },
  });

  if (!attempt) {
    const error = new Error("Tentative introuvable.");
    error.status = 404;
    throw error;
  }

  return attempt;
}

async function getAttemptForReview(attemptId, userId) {
  const attempt = await prisma.attempt.findFirst({
    where: {
      id: attemptId,
      publication: {
        evaluation: {
          userId,
        },
      },
    },

    include: {
      student: true,
      answers: true,
      publication: {
        include: evaluationWithQuestionsInclude,
      },
    },
  });

  if (!attempt) {
    return null;
  }

  const answersByQuestionId = new Map(
    attempt.answers.map((answer) => [answer.questionId, answer])
  );

  const questions = attempt.publication.evaluation.questions.map(
    (question) => ({
      id: question.id,
      statement: question.statement,
      type: question.type,
      points: question.points,
      correctAnswer: question.correctAnswer,
      choices: question.choices,
      answer: answersByQuestionId.get(question.id) || null,
    })
  );

  return {
    attempt: {
      id: attempt.id,
      status: attempt.status,
      exitCount: attempt.exitCount,
      startedAt: attempt.startedAt,
      endsAt: attempt.endsAt,
      submittedAt: attempt.submittedAt,
      score: attempt.score,
      resultsPublished: attempt.resultsPublished,
    },

    student: attempt.student,

    evaluation: {
      title: attempt.publication.evaluation.title,
    },

    questions,
  };
}

function findQuestionOrThrow(attempt, questionId) {
  const question = attempt.publication.evaluation.questions.find(
    (item) => item.id === questionId
  );

  if (!question) {
    const error = new Error("Question introuvable pour cette évaluation.");
    error.status = 404;
    throw error;
  }

  return question;
}

async function gradeAnswerManually(
  attemptId,
  questionId,
  userId,
  { score, feedback }
) {
  const attempt = await requireAttemptOwnedByTeacher(attemptId, userId);
  const question = findQuestionOrThrow(attempt, questionId);

  const clampedScore = Math.min(
    Math.max(Number(score) || 0, 0),
    question.points
  );

  await prisma.answer.upsert({
    where: {
      questionId_attemptId: {
        questionId,
        attemptId,
      },
    },

    update: {
      score: clampedScore,
      feedback: feedback?.trim() || null,
      gradedBy: "TEACHER",
    },

    create: {
      questionId,
      attemptId,
      score: clampedScore,
      feedback: feedback?.trim() || null,
      gradedBy: "TEACHER",
    },
  });

  await recomputeAttemptScore(
    attemptId,
    attempt.publication.evaluation.questions
  );

  return getAttemptForReview(attemptId, userId);
}

async function gradeAnswerWithAiAssist(attemptId, questionId, userId) {
  const attempt = await requireAttemptOwnedByTeacher(attemptId, userId);
  const question = findQuestionOrThrow(attempt, questionId);

  if (question.type !== "SHORT_TEXT" && question.type !== "LONG_TEXT") {
    const error = new Error(
      "La correction par IA n’est disponible que pour les questions à réponse texte."
    );
    error.status = 400;
    throw error;
  }

  const existingAnswer = attempt.answers.find(
    (answer) => answer.questionId === questionId
  );

  const { score, feedback } = await gradeAnswerWithAI(
    question,
    existingAnswer?.textAnswer
  );

  await prisma.answer.upsert({
    where: {
      questionId_attemptId: {
        questionId,
        attemptId,
      },
    },

    update: {
      score,
      feedback,
      gradedBy: "AI",
    },

    create: {
      questionId,
      attemptId,
      score,
      feedback,
      gradedBy: "AI",
      textAnswer: existingAnswer?.textAnswer ?? null,
    },
  });

  await recomputeAttemptScore(
    attemptId,
    attempt.publication.evaluation.questions
  );

  return getAttemptForReview(attemptId, userId);
}

async function publishResults(attemptId, userId) {
  const attempt = await requireAttemptOwnedByTeacher(attemptId, userId);

  if (attempt.status === "IN_PROGRESS") {
    const error = new Error(
      "Cette tentative n’est pas encore terminée."
    );
    error.status = 409;
    throw error;
  }

  await prisma.attempt.update({
    where: {
      id: attemptId,
    },

    data: {
      resultsPublished: true,
    },
  });

  await notifyResultsPublished(
    attempt,
    attempt.score,
    attempt.publication.evaluation.questions
  );

  return getAttemptForReview(attemptId, userId);
}

async function getAnswerFileForTeacher(attemptId, questionId, userId) {
  const attempt = await requireAttemptOwnedByTeacher(attemptId, userId);
  const answer = attempt.answers.find(
    (item) => item.questionId === questionId
  );

  if (!answer?.filePath) {
    const error = new Error("Aucun fichier n’a été envoyé pour cette question.");
    error.status = 404;
    throw error;
  }

  return {
    filePath: path.resolve(answer.filePath),
    fileName: answer.fileName || path.basename(answer.filePath),
  };
}

module.exports = {
  joinPublication,
  getAttempt,
  saveTextAnswer,
  saveFileAnswer,
  registerExit,
  submitAttempt,
  getAttemptForReview,
  gradeAnswerManually,
  gradeAnswerWithAiAssist,
  publishResults,
  getAnswerFileForTeacher,
};
