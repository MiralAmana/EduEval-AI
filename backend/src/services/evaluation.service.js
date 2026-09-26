const prisma = require("../lib/prisma");
const { generateUniqueCode } = require("../lib/publicationCode");

function normalizeChoices(question) {
  if (!Array.isArray(question.choices)) {
    return [];
  }

  return question.choices
    .map((choice) => String(choice).trim())
    .filter(Boolean);
}

function normalizeCriteria(question) {
  if (!Array.isArray(question.criteria)) {
    return [];
  }

  return question.criteria
    .map((criterion) => ({
      label: String(criterion?.label || "").trim(),
      points: Number(criterion?.points),
    }))
    .filter(
      (criterion) => criterion.label && criterion.points > 0
    );
}

function prepareQuestion(question, position) {
  const choices = normalizeChoices(question);
  const criteria = normalizeCriteria(question);

  const correctAnswer = question.correctAnswer
    ? String(question.correctAnswer).trim()
    : null;

  return {
    statement: String(question.statement).trim(),
    type: question.type,
    points: Number(question.points) || 1,
    correctAnswer,
    position,

    choices: {
      create: choices.map((choice, choicePosition) => ({
        text: choice,
        position: choicePosition,
        correct:
          question.type === "QCM" &&
          correctAnswer !== null &&
          choice.toLowerCase() === correctAnswer.toLowerCase(),
      })),
    },

    criteria: {
      create: criteria.map((criterion, criterionPosition) => ({
        label: criterion.label,
        points: criterion.points,
        position: criterionPosition,
      })),
    },
  };
}

const evaluationInclude = {
  user: {
    select: {
      firstName: true,
      lastName: true,
      email: true,
    },
  },

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

  publications: {
    orderBy: {
      createdAt: "desc",
    },

    include: {
      attempts: {
        orderBy: {
          createdAt: "desc",
        },

        include: {
          student: true,
        },
      },

      _count: {
        select: {
          attempts: true,
        },
      },
    },
  },

  _count: {
    select: {
      questions: true,
      publications: true,
    },
  },
};

/**
 * Forme allégée d'une évaluation pour la LISTE de l'enseignant : uniquement
 * ce que la liste affiche (compteurs, statut, code d'accès de chaque
 * publication). L'ancienne réponse embarquait aussi toutes les questions, tous
 * les choix et TOUTES les tentatives avec leurs élèves : 1,1 Mo pour 15
 * évaluations de 100 participants, et une taille qui croît avec chaque
 * tentative. Le détail complet reste servi par getEvaluationById.
 */
const evaluationSummaryInclude = {
  publications: {
    orderBy: {
      createdAt: "desc",
    },

    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      duration: true,
      availableAt: true,
      closesAt: true,
      createdAt: true,

      _count: {
        select: {
          attempts: true,
        },
      },
    },
  },

  _count: {
    select: {
      questions: true,
      publications: true,
    },
  },
};

/**
 * Ajoute `_count.attempts` (total sur toutes les publications) : la liste
 * l'affiche mais Prisma ne sait pas compter à travers une relation imbriquée.
 */
function withAttemptTotal(evaluation) {
  if (!evaluation) {
    return evaluation;
  }

  const attempts = (evaluation.publications || []).reduce(
    (total, publication) => total + (publication._count?.attempts || 0),
    0
  );

  return {
    ...evaluation,
    _count: {
      ...evaluation._count,
      attempts,
    },
  };
}

/**
 * Garantit qu'une évaluation active possède une publication ACTIVE
 * (donc un code d'accès utilisable), en réactivant une publication
 * existante plutôt que d'en recréer une nouvelle.
 */
async function ensureActivePublication(transaction, evaluation) {
  const existingPublication = await transaction.publication.findFirst({
    where: {
      evaluationId: evaluation.id,
    },

    select: {
      id: true,
      status: true,
      duration: true,
    },
  });

  if (existingPublication) {
    const needsStatusUpdate = existingPublication.status !== "ACTIVE";
    const needsDurationSync =
      existingPublication.duration !== evaluation.duration;

    if (needsStatusUpdate || needsDurationSync) {
      await transaction.publication.update({
        where: {
          id: existingPublication.id,
        },

        data: {
          ...(needsStatusUpdate ? { status: "ACTIVE" } : {}),
          ...(needsDurationSync ? { duration: evaluation.duration } : {}),
        },
      });
    }

    return;
  }

  const code = await generateUniqueCode();

  await transaction.publication.create({
    data: {
      name: `${evaluation.title} — Publication`,
      code,
      duration: evaluation.duration,
      status: "ACTIVE",
      evaluationId: evaluation.id,
    },
  });
}

/**
 * Empêche l'accès des étudiants dès qu'une évaluation n'est plus
 * active, même si son code d'accès existe toujours.
 */
async function deactivatePublications(transaction, evaluationId) {
  await transaction.publication.updateMany({
    where: {
      evaluationId,
      status: "ACTIVE",
    },

    data: {
      status: "DISABLED",
    },
  });
}

async function createEvaluation(data, userId) {
  const questions = Array.isArray(data.questions)
    ? data.questions
    : [];

  const status = data.status || "DRAFT";

  return prisma.$transaction(async (transaction) => {
    const evaluation = await transaction.evaluation.create({
      data: {
        title: data.title,
        description: data.description || null,
        instructions: data.instructions || null,
        duration: Number(data.duration),
        contentType: data.contentType || "EVALUATION",
        type: data.type || "CLASSIC",
        status,
        userId,

        questions: {
          create: questions.map((question, index) =>
            prepareQuestion(question, index)
          ),
        },
      },
    });

    if (status === "ACTIVE") {
      await ensureActivePublication(transaction, evaluation);
    }

    return transaction.evaluation.findUnique({
      where: {
        id: evaluation.id,
      },

      include: evaluationInclude,
    });
  });
}

async function getEvaluations(userId) {
  const evaluations = await prisma.evaluation.findMany({
    where: {
      userId,
    },

    orderBy: {
      createdAt: "desc",
    },

    include: evaluationSummaryInclude,
  });

  return evaluations.map(withAttemptTotal);
}

/**
 * Participants de toutes les évaluations de l'enseignant, groupés par
 * évaluation (page « Étudiants »). Sélection minimale : ni questions, ni
 * réponses, ni évaluation complète — seulement ce que le tableau affiche.
 * Les tentatives sont triées de la plus récente à la plus ancienne ; les
 * groupes suivent l'ordre de leur tentative la plus récente.
 */
async function getParticipantsByEvaluation(userId) {
  const attempts = await prisma.attempt.findMany({
    where: {
      publication: {
        evaluation: {
          userId,
        },
      },
    },

    orderBy: {
      startedAt: "desc",
    },

    select: {
      id: true,
      startedAt: true,
      status: true,
      exitCount: true,
      resultsPublished: true,

      student: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },

      publication: {
        select: {
          evaluation: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
    },
  });

  const groups = new Map();

  for (const { publication, ...attempt } of attempts) {
    const { evaluation } = publication;

    if (!groups.has(evaluation.id)) {
      groups.set(evaluation.id, {
        evaluationId: evaluation.id,
        evaluationTitle: evaluation.title,
        attempts: [],
      });
    }

    groups.get(evaluation.id).attempts.push(attempt);
  }

  return [...groups.values()];
}

async function getEvaluationById(id, userId) {
  return prisma.evaluation.findFirst({
    where: {
      id,
      userId,
    },

    include: evaluationInclude,
  });
}

async function updateEvaluation(id, userId, data) {
  const questions = Array.isArray(data.questions)
    ? data.questions
    : null;

  return prisma.$transaction(async (transaction) => {
    const existingEvaluation =
      await transaction.evaluation.findFirst({
        where: {
          id,
          userId,
        },

        select: {
          id: true,
        },
      });

    if (!existingEvaluation) {
      return null;
    }

    if (questions !== null) {
      await transaction.question.deleteMany({
        where: {
          evaluationId: id,
        },
      });
    }

    const evaluation = await transaction.evaluation.update({
      where: {
        id,
      },

      data: {
        title: data.title,
        description: data.description || null,
        instructions: data.instructions || null,
        duration: Number(data.duration),
        contentType: data.contentType,
        type: data.type,
        status: data.status,

        ...(questions !== null
          ? {
              questions: {
                create: questions.map((question, index) =>
                  prepareQuestion(question, index)
                ),
              },
            }
          : {}),
      },
    });

    if (evaluation.status === "ACTIVE") {
      await ensureActivePublication(transaction, evaluation);
    } else {
      await deactivatePublications(transaction, id);
    }

    return transaction.evaluation.findUnique({
      where: {
        id,
      },

      include: evaluationInclude,
    });
  });
}

async function deleteEvaluation(id, userId) {
  const existingEvaluation =
    await prisma.evaluation.findFirst({
      where: {
        id,
        userId,
      },

      select: {
        id: true,
      },
    });

  if (!existingEvaluation) {
    return null;
  }

  return prisma.evaluation.delete({
    where: {
      id,
    },
  });
}

async function updateEvaluationStatus(id, userId, status) {
  return prisma.$transaction(async (transaction) => {
    const existingEvaluation =
      await transaction.evaluation.findFirst({
        where: {
          id,
          userId,
        },

        select: {
          id: true,
        },
      });

    if (!existingEvaluation) {
      return null;
    }

    const evaluation = await transaction.evaluation.update({
      where: {
        id,
      },

      data: {
        status,
      },
    });

    if (status === "ACTIVE") {
      await ensureActivePublication(transaction, evaluation);
    } else {
      await deactivatePublications(transaction, id);
    }

    // Seule la liste enseignant appelle cette route et en fusionne la réponse
    // dans son état : forme allégée, comme la liste.
    return withAttemptTotal(
      await transaction.evaluation.findUnique({
        where: {
          id,
        },

        include: evaluationSummaryInclude,
      })
    );
  });
}

async function duplicateEvaluation(id, userId) {
  const sourceEvaluation =
    await prisma.evaluation.findFirst({
      where: {
        id,
        userId,
      },

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
    });

  if (!sourceEvaluation) {
    return null;
  }

  // Comme updateEvaluationStatus : seule la liste enseignant en fusionne la
  // réponse dans son état, forme allégée.
  const duplicated = await prisma.evaluation.create({
    data: {
      title: `${sourceEvaluation.title} — Copie`,
      description: sourceEvaluation.description,
      instructions: sourceEvaluation.instructions,
      duration: sourceEvaluation.duration,
      contentType: sourceEvaluation.contentType,
      type: sourceEvaluation.type,
      status: "DRAFT",
      userId,

      questions: {
        create: sourceEvaluation.questions.map((question) => ({
          statement: question.statement,
          type: question.type,
          points: question.points,
          correctAnswer: question.correctAnswer,
          position: question.position,

          choices: {
            create: question.choices.map((choice) => ({
              text: choice.text,
              correct: choice.correct,
              position: choice.position,
            })),
          },

          criteria: {
            create: question.criteria.map((criterion) => ({
              label: criterion.label,
              points: criterion.points,
              position: criterion.position,
            })),
          },
        })),
      },
    },

    include: evaluationSummaryInclude,
  });

  return withAttemptTotal(duplicated);
}

module.exports = {
  createEvaluation,
  getEvaluations,
  getParticipantsByEvaluation,
  getEvaluationById,
  updateEvaluation,
  deleteEvaluation,
  updateEvaluationStatus,
  duplicateEvaluation,
};