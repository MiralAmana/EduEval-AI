const prisma = require("../lib/prisma");

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

async function createEvaluation(data) {
  const questions = Array.isArray(data.questions)
    ? data.questions
    : [];

  return prisma.evaluation.create({
    data: {
      title: data.title,
      description: data.description || null,
      instructions: data.instructions || null,
      duration: Number(data.duration),
      contentType: data.contentType || "EVALUATION",
      type: data.type || "CLASSIC",
      status: data.status || "DRAFT",

      questions: {
        create: questions.map((question, index) =>
          prepareQuestion(question, index)
        ),
      },
    },

    include: evaluationInclude,
  });
}

async function getEvaluations() {
  return prisma.evaluation.findMany({
    orderBy: {
      createdAt: "desc",
    },

    include: evaluationInclude,
  });
}

async function getEvaluationById(id) {
  return prisma.evaluation.findUnique({
    where: {
      id,
    },

    include: evaluationInclude,
  });
}

async function updateEvaluation(id, data) {
  const questions = Array.isArray(data.questions)
    ? data.questions
    : null;

  return prisma.$transaction(async (transaction) => {
    const existingEvaluation =
      await transaction.evaluation.findUnique({
        where: {
          id,
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

    return transaction.evaluation.update({
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

      include: evaluationInclude,
    });
  });
}

async function deleteEvaluation(id) {
  const existingEvaluation =
    await prisma.evaluation.findUnique({
      where: {
        id,
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

async function updateEvaluationStatus(id, status) {
  const existingEvaluation =
    await prisma.evaluation.findUnique({
      where: {
        id,
      },

      select: {
        id: true,
      },
    });

  if (!existingEvaluation) {
    return null;
  }

  return prisma.evaluation.update({
    where: {
      id,
    },

    data: {
      status,
    },

    include: evaluationInclude,
  });
}

async function duplicateEvaluation(id) {
  const sourceEvaluation =
    await prisma.evaluation.findUnique({
      where: {
        id,
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