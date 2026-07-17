const prisma = require("../lib/prisma");

const CODE_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(length = 6) {
  let code = "";

  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(
      Math.random() * CODE_CHARACTERS.length
    );

    code += CODE_CHARACTERS[randomIndex];
  }

  return code;
}

async function generateUniqueCode() {
  let code = generateCode();

  while (
    await prisma.publication.findUnique({
      where: { code },
      select: { id: true },
    })
  ) {
    code = generateCode();
  }

  return code;
}

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

async function createPublication(evaluationId, data) {
  const evaluation = await prisma.evaluation.findUnique({
    where: {
      id: evaluationId,
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

async function getPublications() {
  return prisma.publication.findMany({
    orderBy: {
      createdAt: "desc",
    },

    include: publicationInclude,
  });
}

async function getPublicationsByEvaluation(evaluationId) {
  return prisma.publication.findMany({
    where: {
      evaluationId,
    },

    orderBy: {
      createdAt: "desc",
    },

    include: publicationInclude,
  });
}

async function getPublicationById(id) {
  return prisma.publication.findUnique({
    where: {
      id,
    },

    include: publicationInclude,
  });
}

async function getPublicationByCode(code) {
  return prisma.publication.findUnique({
    where: {
      code: String(code).trim().toUpperCase(),
    },

    include: publicationInclude,
  });
}

async function updatePublication(id, data) {
  const existingPublication =
    await prisma.publication.findUnique({
      where: {
        id,
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

async function updatePublicationStatus(id, status) {
  const existingPublication =
    await prisma.publication.findUnique({
      where: {
        id,
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

async function regeneratePublicationCode(id) {
  const existingPublication =
    await prisma.publication.findUnique({
      where: {
        id,
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

async function duplicatePublication(id) {
  const sourcePublication =
    await prisma.publication.findUnique({
      where: {
        id,
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

async function deletePublication(id) {
  const existingPublication =
    await prisma.publication.findUnique({
      where: {
        id,
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