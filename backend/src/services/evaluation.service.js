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

function prepareQuestion(question, position) {
  const choices = normalizeChoices(question);

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
  };
}

const evaluationInclude = {
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
    },
  });

  if (existingPublication) {
    if (existingPublication.status !== "ACTIVE") {
      await transaction.publication.update({
        where: {
          id: existingPublication.id,
        },

        data: {
          status: "ACTIVE",
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
  return prisma.evaluation.findMany({
    where: {
      userId,
    },

    orderBy: {
      createdAt: "desc",
    },

    include: evaluationInclude,
  });
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

    return transaction.evaluation.findUnique({
      where: {
        id,
      },

      include: evaluationInclude,
    });
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
          },
        },
      },
    });

  if (!sourceEvaluation) {
    return null;
  }

  return prisma.evaluation.create({
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
        })),
      },
    },

    include: evaluationInclude,
  });
}

module.exports = {
  createEvaluation,
  getEvaluations,
  getEvaluationById,
  updateEvaluation,
  deleteEvaluation,
  updateEvaluationStatus,
  duplicateEvaluation,
};