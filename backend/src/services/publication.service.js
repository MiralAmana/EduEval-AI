const prisma = require("../lib/prisma");
const { generateUniqueCode } = require("../lib/publicationCode");

const publicationInclude = {
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
};

async function createPublication(evaluationId, userId, data) {
  const evaluation = await prisma.evaluation.findFirst({
    where: {
      id: evaluationId,
      userId,
    },

    select: {
      id: true,
      title: true,
      duration: true,
    },
  });

  if (!evaluation) {
    return null;
  }

  const code = await generateUniqueCode();

  return prisma.publication.create({
    data: {
      name:
        data.name?.trim() ||
        `${evaluation.title} — Publication`,

      code,

      duration:
        Number(data.duration) ||
        evaluation.duration,

      status: data.status || "DRAFT",

      availableAt: data.availableAt
        ? new Date(data.availableAt)
        : null,

      closesAt: data.closesAt
        ? new Date(data.closesAt)
        : null,

      evaluationId,
    },

    include: publicationInclude,
  });
}

async function getPublications(userId) {
  return prisma.publication.findMany({
    where: {
      evaluation: {
        userId,
      },
    },

    orderBy: {
      createdAt: "desc",
    },

    include: publicationInclude,
  });
}

async function getPublicationsByEvaluation(evaluationId, userId) {
  return prisma.publication.findMany({
    where: {
      evaluationId,
      evaluation: {
        userId,
      },
    },

    orderBy: {
      createdAt: "desc",
    },

    include: publicationInclude,
  });
}

async function getPublicationById(id, userId) {
  return prisma.publication.findFirst({
    where: {
      id,
      evaluation: {
        userId,
      },
    },

    include: publicationInclude,
  });
}

async function getPublicationByCode(code) {
  return prisma.publication.findUnique({
    where: {
      code: String(code).trim().toUpperCase(),
    },

    include: {
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
    },
  });
}

async function updatePublication(id, userId, data) {
  const existingPublication =
    await prisma.publication.findFirst({
      where: {
        id,
        evaluation: {
          userId,
        },
      },

      select: {
        id: true,
      },
    });

  if (!existingPublication) {
    return null;
  }

  return prisma.publication.update({
    where: {
      id,
    },

    data: {
      name: data.name?.trim() || null,

      duration: Number(data.duration),

      status: data.status,

      availableAt: data.availableAt
        ? new Date(data.availableAt)
        : null,

      closesAt: data.closesAt
        ? new Date(data.closesAt)
        : null,
    },

    include: publicationInclude,
  });
}

async function updatePublicationStatus(id, userId, status) {
  const existingPublication =
    await prisma.publication.findFirst({
      where: {
        id,
        evaluation: {
          userId,
        },
      },

      select: {
        id: true,
      },
    });

  if (!existingPublication) {
    return null;
  }

  return prisma.publication.update({
    where: {
      id,
    },

    data: {
      status,
    },

    include: publicationInclude,
  });
}

async function regeneratePublicationCode(id, userId) {
  const existingPublication =
    await prisma.publication.findFirst({
      where: {
        id,
        evaluation: {
          userId,
        },
      },

      select: {
        id: true,
      },
    });

  if (!existingPublication) {
    return null;
  }

  const code = await generateUniqueCode();

  return prisma.publication.update({
    where: {
      id,
    },

    data: {
      code,
    },

    include: publicationInclude,
  });
}

async function duplicatePublication(id, userId) {
  const sourcePublication =
    await prisma.publication.findFirst({
      where: {
        id,
        evaluation: {
          userId,
        },
      },
    });

  if (!sourcePublication) {
    return null;
  }

  const code = await generateUniqueCode();

  return prisma.publication.create({
    data: {
      name: sourcePublication.name
        ? `${sourcePublication.name} — Copie`
        : "Publication — Copie",

      code,

      duration: sourcePublication.duration,

      status: "DRAFT",

      availableAt: null,

      closesAt: null,

      evaluationId:
        sourcePublication.evaluationId,
    },

    include: publicationInclude,
  });
}

async function deletePublication(id, userId) {
  const existingPublication =
    await prisma.publication.findFirst({
      where: {
        id,
        evaluation: {
          userId,
        },
      },

      select: {
        id: true,
      },
    });

  if (!existingPublication) {
    return null;
  }

  return prisma.publication.delete({
    where: {
      id,
    },
  });
}

module.exports = {
  createPublication,
  getPublications,
  getPublicationsByEvaluation,
  getPublicationById,
  getPublicationByCode,
  updatePublication,
  updatePublicationStatus,
  regeneratePublicationCode,
  duplicatePublication,
  deletePublication,
};