const path = require("node:path");

const mammoth = require("mammoth");
const XLSX = require("xlsx");
const sanitizeHtml = require("sanitize-html");

const prisma = require("../lib/prisma");
const attemptCache = require("../lib/attemptCache");
const { sanitizeQuestionsForStudent } = require("../lib/sanitize");
const { gradeAnswerWithAI } = require("./grading.service");
const { sendResultsPublishedEmail } = require("./email.service");
const storageService = require("./storage.service");

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

          criteria: {
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

/**
 * Calcule les notes automatiques d'une copie, sans rien écrire : le total
 * et la note de chaque réponse (null = à corriger par l'enseignant).
 */
function computeGrades(questions, answers) {
  const answersByQuestionId = new Map(
    answers.map((answer) => [answer.questionId, answer])
  );

  const scoreByAnswerId = new Map();
  let total = 0;

  for (const question of questions) {
    const answer = answersByQuestionId.get(question.id);
    const score = gradeAnswer(question, answer);

    if (answer) {
      scoreByAnswerId.set(answer.id, score);
    }

    total += score || 0;
  }

  return { total, scoreByAnswerId };
}

/**
 * Une écriture par valeur de note distincte (un `updateMany` sur toutes
 * les réponses qui ont cette note) plutôt qu'un UPDATE par réponse : une
 * copie de 20 questions passe de 20 requêtes à 2 ou 3. Les réponses
 * non notées automatiquement (null) ne sont pas touchées, pour ne pas
 * écraser une note déjà saisie par l'enseignant.
 */
function buildScoreWrites(scoreByAnswerId, answers) {
  const answerIdsByScore = new Map();

  for (const answer of answers) {
    const score = scoreByAnswerId.get(answer.id);

    if (score === null || score === undefined || answer.score === score) {
      continue;
    }

    if (!answerIdsByScore.has(score)) {
      answerIdsByScore.set(score, []);
    }

    answerIdsByScore.get(score).push(answer.id);
  }

  return [...answerIdsByScore].map(([score, ids]) =>
    prisma.answer.updateMany({
      where: {
        id: {
          in: ids,
        },
      },

      data: {
        score,
      },
    })
  );
}

async function gradeAttempt(attemptId, questions) {
  const answers = await prisma.answer.findMany({
    where: {
      attemptId,
    },
  });

  const { total, scoreByAnswerId } = computeGrades(questions, answers);
  const writes = buildScoreWrites(scoreByAnswerId, answers);

  if (writes.length > 0) {
    await prisma.$transaction(writes);
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

/**
 * Clôture une tentative (soumission, expiration ou blocage) : note les
 * réponses et passe la tentative à son statut final dans UNE transaction
 * (BEGIN + quelques écritures + COMMIT), puis renvoie la tentative à jour
 * construite en mémoire — pas de rechargement complet depuis la base, qui
 * coûtait une requête SQL par relation au moment où tous les élèves
 * soumettent ensemble. Les réponses sont relues à cet instant (et non prises
 * dans le contexte en cache) pour ne perdre aucune sauvegarde récente.
 */
async function finalizeAttempt(attempt, status, submittedAt) {
  const questions = attempt.publication.evaluation.questions;

  const answers = await prisma.answer.findMany({
    where: {
      attemptId: attempt.id,
    },

    include: {
      criterionScores: true,
    },
  });

  const { total, scoreByAnswerId } = computeGrades(questions, answers);
  const resultsPublished = isPureQcm(questions);

  await prisma.$transaction([
    ...buildScoreWrites(scoreByAnswerId, answers),

    prisma.attempt.update({
      where: {
        id: attempt.id,
      },

      data: {
        status,
        submittedAt,
        score: total,
        resultsPublished,
      },
    }),
  ]);

  const finalizedAttempt = {
    ...attempt,
    status,
    submittedAt,
    score: total,
    resultsPublished,

    answers: answers.map((answer) => {
      const score = scoreByAnswerId.get(answer.id);

      return score === null || score === undefined
        ? answer
        : { ...answer, score };
    }),
  };

  attemptCache.set(attempt.id, finalizedAttempt);

  if (resultsPublished) {
    // Sans attendre : l'envoi de l'email (API externe, quotas) ne doit pas
    // retarder la réponse à l'élève. notifyResultsPublished ne rejette jamais.
    notifyResultsPublished(attempt, total, questions);
  }

  return finalizedAttempt;
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

  attemptCache.invalidate(attemptId);
}

async function getAttemptWithContext(attemptId) {
  const cached = attemptCache.get(attemptId);

  if (cached) {
    return cached;
  }

  const attempt = await prisma.attempt.findUnique({
    where: {
      id: attemptId,
    },

    include: {
      answers: {
        include: {
          criterionScores: true,
        },
      },
      student: true,
      publication: {
        include: evaluationWithQuestionsInclude,
      },
    },
  });

  if (attempt) {
    attemptCache.set(attemptId, attempt);
  }

  return attempt;
}

/**
 * Vérifie et applique l'expiration d'une tentative en cours dont le
 * temps est écoulé, en la notant automatiquement avec les réponses
 * déjà enregistrées.
 */
async function ensureAttemptIsCurrent(attempt) {
  if (attempt.status === "IN_PROGRESS" && new Date() >= attempt.endsAt) {
    return finalizeAttempt(attempt, "EXPIRED", attempt.endsAt);
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
            ...(revealScores
              ? {
                  score: answer.score,
                  criterionScores: answer.criterionScores.map((entry) => ({
                    criterionId: entry.criterionId,
                    pointsAwarded: entry.pointsAwarded,
                  })),
                }
              : {}),
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
      type: evaluation.type,
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
      answers: {
        include: {
          criterionScores: true,
        },
      },
      student: true,
      publication: {
        include: evaluationWithQuestionsInclude,
      },
    },
  });

  if (!attempt) {
    const createdAttempt = await prisma.attempt.create({
      data: {
        publicationId: publication.id,
        studentId: student.id,
        endsAt: new Date(Date.now() + publication.duration * 60 * 1000),
      },
    });

    // Le contexte complet est déjà en main (publication + questions chargées
    // plus haut, élève tout juste enregistré) : pas la peine de le relire en
    // base (9 requêtes) pour une tentative qui n'a encore aucune réponse.
    attempt = {
      ...createdAttempt,
      answers: [],
      student,
      publication,
    };
  }

  attempt = await ensureAttemptIsCurrent(attempt);

  if (attempt.status !== "IN_PROGRESS") {
    const error = new Error(
      "Cette tentative est déjà terminée et ne peut pas être reprise."
    );
    error.status = 409;
    throw error;
  }

  // Le premier enregistrement de réponse trouvera le contexte en cache.
  attemptCache.set(attempt.id, attempt);

  return buildStudentPayload(attempt);
}

async function getAttemptEvaluationType(attemptId) {
  const attempt = await prisma.attempt.findUnique({
    where: {
      id: attemptId,
    },

    select: {
      publication: {
        select: {
          evaluation: {
            select: {
              type: true,
            },
          },
        },
      },
    },
  });

  return attempt?.publication.evaluation.type || null;
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

/**
 * Reconstruit localement l'attempt déjà chargé en mémoire avec une
 * réponse ajoutée/modifiée, pour éviter de refaire un aller-retour
 * complet en base après chaque sauvegarde (autosave à chaque frappe).
 */
function withUpdatedAnswer(attempt, answer) {
  const hasAnswer = attempt.answers.some(
    (item) => item.questionId === answer.questionId
  );

  const answers = hasAnswer
    ? attempt.answers.map((item) =>
        item.questionId === answer.questionId ? answer : item
      )
    : [...attempt.answers, answer];

  return { ...attempt, answers };
}

/**
 * Répercute une réponse qui vient d'être enregistrée dans le contexte en
 * cache (voir attemptCache.update) et renvoie le contexte à jour, ou
 * undefined si l'entrée a expiré. Le contexte chargé depuis la base porte
 * `criterionScores` sur chaque réponse, alors que l'upsert ne le renvoie
 * pas : on garde celui de la réponse précédente pour conserver la même forme.
 */
function applyAnswerToCache(attemptId, answer) {
  return attemptCache.update(attemptId, (cached) => {
    const previous = cached.answers.find(
      (item) => item.questionId === answer.questionId
    );

    return withUpdatedAnswer(cached, {
      ...answer,
      criterionScores: previous?.criterionScores ?? [],
    });
  });
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

  const answer = await prisma.answer.upsert({
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

  return buildStudentPayload(
    applyAnswerToCache(attemptId, answer) ??
      withUpdatedAnswer(attempt, answer)
  );
}

async function saveFileAnswer(
  attemptId,
  questionId,
  localFilePath,
  fileName,
  contentType
) {
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

  // Le fichier reçu par multer n'est qu'un dépôt temporaire local :
  // la copie durable vit sur le stockage objet (survit aux redéploiements), pas sur
  // le disque de l'instance backend.
  const objectKey = storageService.buildAnswerObjectKey(
    attemptId,
    questionId,
    fileName
  );

  // Le fichier temporaire est supprimé par l'appelant (contrôleur), dans
  // tous les cas — succès, refus ou erreur — et pas seulement après un envoi
  // réussi.
  await storageService.uploadFile(localFilePath, objectKey, contentType);

  if (existingAnswer?.filePath) {
    await storageService.deleteFile(existingAnswer.filePath);
  }

  const answer = await prisma.answer.upsert({
    where: {
      questionId_attemptId: {
        questionId,
        attemptId,
      },
    },

    update: {
      filePath: objectKey,
      fileName,
    },

    create: {
      questionId,
      attemptId,
      filePath: objectKey,
      fileName,
    },
  });

  return buildStudentPayload(
    applyAnswerToCache(attemptId, answer) ??
      withUpdatedAnswer(attempt, answer)
  );
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

  attemptCache.update(attemptId, (cached) => ({
    ...cached,
    exitCount: nextExitCount,
  }));

  if (shouldBlock) {
    const blockedAttempt = await finalizeAttempt(
      { ...attempt, exitCount: nextExitCount },
      "BLOCKED",
      new Date()
    );

    return buildStudentPayload(blockedAttempt);
  }

  return buildStudentPayload({ ...attempt, exitCount: nextExitCount });
}

/**
 * Idempotent : soumettre une tentative déjà terminée (double clic, nouvel
 * essai après une coupure réseau, temps écoulé côté serveur juste avant la
 * requête) renvoie son état final au lieu d'une erreur, pour que le client
 * puisse simplement réessayer sans risque.
 */
async function submitAttempt(attemptId) {
  let attempt = await getAttemptWithContext(attemptId);

  if (!attempt) {
    const error = new Error("Tentative introuvable.");
    error.status = 404;
    throw error;
  }

  attempt = await ensureAttemptIsCurrent(attempt);

  if (attempt.status !== "IN_PROGRESS") {
    return buildStudentPayload(attempt);
  }

  if (attempt.publication.status !== "ACTIVE") {
    const error = new Error("Cette évaluation n’est plus disponible.");
    error.status = 403;
    throw error;
  }

  const submittedAttempt = await finalizeAttempt(
    attempt,
    "SUBMITTED",
    new Date()
  );

  return buildStudentPayload(submittedAttempt);
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
      answers: {
        include: {
          criterionScores: true,
        },
      },
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

/**
 * Réduit une réponse (objet Prisma complet) à ce qu'une vue de
 * correction enseignant a besoin d'afficher, en particulier en
 * ramenant criterionScores à sa forme {criterionId, pointsAwarded}
 * plutôt que d'exposer les lignes brutes de la table CriterionScore.
 */
function sanitizeAnswerForReview(answer) {
  if (!answer) {
    return null;
  }

  return {
    ...answer,
    criterionScores: answer.criterionScores.map((entry) => ({
      criterionId: entry.criterionId,
      pointsAwarded: entry.pointsAwarded,
    })),
  };
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
      answers: {
        include: {
          criterionScores: true,
        },
      },
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
      criteria: question.criteria,
      answer: sanitizeAnswerForReview(
        answersByQuestionId.get(question.id)
      ),
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

/**
 * Calcule le total d'un barème détaillé à partir des points saisis
 * par critère, en clampant chaque entrée à son maximum et en
 * ignorant les identifiants de critère inconnus.
 */
function computeCriteriaTotal(criteria, criterionScores) {
  const criteriaById = new Map(
    criteria.map((criterion) => [criterion.id, criterion])
  );

  return (criterionScores || [])
    .filter((entry) => criteriaById.has(entry?.criterionId))
    .reduce((sum, entry) => {
      const criterion = criteriaById.get(entry.criterionId);
      const pointsAwarded = Math.min(
        Math.max(Number(entry.pointsAwarded) || 0, 0),
        criterion.points
      );

      return sum + pointsAwarded;
    }, 0);
}

/**
 * Enregistre le détail par critère d'une réponse déjà notée. Les
 * critères non présents dans criterionScores sont supprimés (ex. un
 * critère décoché repasse à "non noté" plutôt que de garder une
 * ancienne valeur périmée).
 */
async function saveCriterionScores(answerId, criteria, criterionScores) {
  const criteriaById = new Map(
    criteria.map((criterion) => [criterion.id, criterion])
  );

  const validEntries = (criterionScores || [])
    .filter((entry) => criteriaById.has(entry?.criterionId))
    .map((entry) => {
      const criterion = criteriaById.get(entry.criterionId);

      return {
        criterionId: entry.criterionId,
        pointsAwarded: Math.min(
          Math.max(Number(entry.pointsAwarded) || 0, 0),
          criterion.points
        ),
      };
    });

  await prisma.criterionScore.deleteMany({
    where: {
      answerId,
      criterionId: {
        notIn: validEntries.map((entry) => entry.criterionId),
      },
    },
  });

  await Promise.all(
    validEntries.map((entry) =>
      prisma.criterionScore.upsert({
        where: {
          criterionId_answerId: {
            criterionId: entry.criterionId,
            answerId,
          },
        },

        update: {
          pointsAwarded: entry.pointsAwarded,
        },

        create: {
          criterionId: entry.criterionId,
          answerId,
          pointsAwarded: entry.pointsAwarded,
        },
      })
    )
  );
}

async function gradeAnswerManually(
  attemptId,
  questionId,
  userId,
  { score, feedback, criterionScores }
) {
  const attempt = await requireAttemptOwnedByTeacher(attemptId, userId);
  const question = findQuestionOrThrow(attempt, questionId);

  const useCriteria =
    Array.isArray(criterionScores) && question.criteria.length > 0;

  const clampedScore = useCriteria
    ? computeCriteriaTotal(question.criteria, criterionScores)
    : Math.min(Math.max(Number(score) || 0, 0), question.points);

  const answer = await prisma.answer.upsert({
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

  if (useCriteria) {
    await saveCriterionScores(answer.id, question.criteria, criterionScores);
  }

  await recomputeAttemptScore(
    attemptId,
    attempt.publication.evaluation.questions
  );

  return getAttemptForReview(attemptId, userId);
}

const MAX_PRIOR_GRADING_CONTEXT = 5;

/**
 * Résume les questions déjà notées (par un enseignant ou par l'IA) sur
 * la même copie, pour que la correction IA d'une question reste
 * cohérente avec le niveau d'exigence déjà appliqué aux précédentes.
 * Bornée pour ne pas faire grossir le prompt sans limite sur les
 * évaluations à beaucoup de questions rédigées.
 */
function buildGradingContext(attempt, currentQuestionId) {
  const questionsById = new Map(
    attempt.publication.evaluation.questions.map((question) => [
      question.id,
      question,
    ])
  );

  return attempt.answers
    .filter(
      (answer) =>
        answer.questionId !== currentQuestionId &&
        answer.gradedBy &&
        answer.score !== null &&
        answer.score !== undefined
    )
    .map((answer) => {
      const question = questionsById.get(answer.questionId);

      return question
        ? {
            statement: question.statement,
            points: question.points,
            textAnswer: answer.textAnswer,
            score: answer.score,
          }
        : null;
    })
    .filter(Boolean)
    .slice(0, MAX_PRIOR_GRADING_CONTEXT);
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

  const priorGrading = buildGradingContext(attempt, questionId);

  const { score, feedback, criterionScores } = await gradeAnswerWithAI(
    question,
    existingAnswer?.textAnswer,
    priorGrading,
    question.criteria
  );

  const answer = await prisma.answer.upsert({
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

  if (criterionScores) {
    await saveCriterionScores(answer.id, question.criteria, criterionScores);
  }

  await recomputeAttemptScore(
    attemptId,
    attempt.publication.evaluation.questions
  );

  return getAttemptForReview(attemptId, userId);
}

/**
 * Liste, pour une question donnée, la réponse de chaque copie
 * terminée de l'évaluation — pour corriger "question par question"
 * plutôt que copie par copie. Inclut les copies n'ayant pas répondu à
 * cette question (answer null) : un étudiant qui l'a laissée vide
 * doit quand même apparaître dans la liste à corriger.
 */
async function getQuestionAnswersForReview(evaluationId, questionId, userId) {
  const question = await prisma.question.findFirst({
    where: {
      id: questionId,
      evaluationId,
      evaluation: {
        userId,
      },
    },

    include: {
      choices: {
        orderBy: {
          position: "asc",
        },
      },

      criteria: {
        orderBy: {
          position: "asc",
        },
      },
    },
  });

  if (!question) {
    return null;
  }

  const attempts = await prisma.attempt.findMany({
    where: {
      status: {
        not: "IN_PROGRESS",
      },

      publication: {
        evaluationId,
      },
    },

    include: {
      student: true,
      answers: {
        where: {
          questionId,
        },

        include: {
          criterionScores: true,
        },
      },
    },

    orderBy: [
      {
        student: {
          lastName: "asc",
        },
      },
      {
        student: {
          firstName: "asc",
        },
      },
    ],
  });

  return {
    question: {
      id: question.id,
      statement: question.statement,
      type: question.type,
      points: question.points,
      correctAnswer: question.correctAnswer,
      choices: question.choices,
      criteria: question.criteria,
    },

    answers: attempts.map((attempt) => {
      const answer = attempt.answers[0] || null;

      return {
        attemptId: attempt.id,
        attemptStatus: attempt.status,
        student: {
          firstName: attempt.student.firstName,
          lastName: attempt.student.lastName,
          email: attempt.student.email,
        },
        textAnswer: answer?.textAnswer ?? null,
        filePath: answer?.filePath ?? null,
        fileName: answer?.fileName ?? null,
        score: answer?.score ?? null,
        feedback: answer?.feedback ?? null,
        gradedBy: answer?.gradedBy ?? null,
        criterionScores: answer
          ? answer.criterionScores.map((entry) => ({
              criterionId: entry.criterionId,
              pointsAwarded: entry.pointsAwarded,
            }))
          : [],
      };
    }),
  };
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

  attemptCache.invalidate(attemptId);

  // Sans attendre : l'email passe par la file d'envoi (débit limité), qui peut
  // être occupée ; la publication ne doit pas en dépendre.
  // notifyResultsPublished ne rejette jamais.
  notifyResultsPublished(
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

  const buffer = await storageService.downloadFileBuffer(answer.filePath);

  return {
    buffer,
    fileName: answer.fileName || path.basename(answer.filePath),
  };
}

/**
 * Liste blanche stricte pour l'aperçu HTML des fichiers déposés par les
 * étudiants (mammoth pour .docx, XLSX.utils.sheet_to_html pour .xlsx) :
 * ce HTML est affiché en `dangerouslySetInnerHTML` côté enseignant, il
 * doit donc être neutralisé avant de quitter le backend (schémas
 * dangereux type `javascript:` dans un lien, balises actives, etc.).
 *
 * `sanitize-html` est volontairement figé à 2.17.1 (dépendance
 * htmlparser2 ^8, CommonJS) : à partir de 2.17.2, htmlparser2 devient
 * ESM-only et casse le require() sous Jest. Les CVE corrigées par les
 * versions plus récentes (jusqu'à 2.17.7) portent toutes sur des
 * balises/attributs qu'on n'autorise pas ici (svg, textarea, action,
 * formaction, data, poster, background) : la liste blanche ci-dessous
 * n'y est donc pas exposée. Revoir ce pin si htmlparser2 republie un
 * build CJS, ou si le projet migre vers ESM/une config Jest avec
 * transformIgnorePatterns.
 */
const FILE_PREVIEW_SANITIZE_OPTIONS = {
  allowedTags: [
    "p", "br", "strong", "b", "em", "i", "u", "s", "sub", "sup",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li",
    "table", "thead", "tbody", "tr", "td", "th", "colgroup", "col",
    "span", "div", "blockquote", "code", "pre", "a", "img",
  ],
  allowedAttributes: {
    a: ["href"],
    img: ["src", "alt", "width", "height"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan"],
    col: ["span"],
  },
  // sheet_to_html enveloppe le tableau dans <html><head><title>SheetJS Table
  // Export</title>… : sans "title"/"head" ici, le texte du titre s'afficherait.
  nonTextTags: ["script", "style", "textarea", "option", "title", "head"],
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: {
    img: ["data", "http", "https"],
  },
  disallowedTagsMode: "discard",
};

function sanitizeFilePreviewHtml(html) {
  return sanitizeHtml(html, FILE_PREVIEW_SANITIZE_OPTIONS);
}

async function getAnswerFilePreview(attemptId, questionId, userId) {
  const attempt = await requireAttemptOwnedByTeacher(attemptId, userId);
  const answer = attempt.answers.find(
    (item) => item.questionId === questionId
  );

  if (!answer?.filePath) {
    const error = new Error("Aucun fichier n’a été envoyé pour cette question.");
    error.status = 404;
    throw error;
  }

  const extension = path
    .extname(answer.fileName || answer.filePath)
    .toLowerCase();

  if (extension === ".doc" || extension === ".docx") {
    const buffer = await storageService.downloadFileBuffer(answer.filePath);
    const result = await mammoth.convertToHtml({ buffer });

    return { previewType: "html", html: sanitizeFilePreviewHtml(result.value) };
  }

  if (extension === ".xls" || extension === ".xlsx") {
    const buffer = await storageService.downloadFileBuffer(answer.filePath);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const html = XLSX.utils.sheet_to_html(sheet);

    return { previewType: "html", html: sanitizeFilePreviewHtml(html) };
  }

  return { previewType: "unsupported" };
}

module.exports = {
  joinPublication,
  getAttempt,
  getAttemptEvaluationType,
  saveTextAnswer,
  saveFileAnswer,
  registerExit,
  submitAttempt,
  getAttemptForReview,
  gradeAnswerManually,
  gradeAnswerWithAiAssist,
  getQuestionAnswersForReview,
  publishResults,
  getAnswerFileForTeacher,
  getAnswerFilePreview,

  // Exportées pour les tests unitaires de la logique de notation
  // (critique métier, voir backend/src/services/__tests__).
  gradeAnswer,
  isPureQcm,
  gradeAttempt,
  withUpdatedAnswer,
  buildGradingContext,
};
