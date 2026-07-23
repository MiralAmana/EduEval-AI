const publicationService = require(
  "../services/publication.service"
);
const { sanitizeQuestionsForStudent } = require("../lib/sanitize");

const allowedStatuses = [
  "DRAFT",
  "ACTIVE",
  "DISABLED",
  "FINISHED",
];

function validateDates(
  availableAt,
  closesAt
) {
  if (
    availableAt &&
    Number.isNaN(
      new Date(availableAt).getTime()
    )
  ) {
    return "La date d’ouverture est invalide.";
  }

  if (
    closesAt &&
    Number.isNaN(
      new Date(closesAt).getTime()
    )
  ) {
    return "La date de fermeture est invalide.";
  }

  if (
    availableAt &&
    closesAt &&
    new Date(closesAt) <=
      new Date(availableAt)
  ) {
    return "La date de fermeture doit être postérieure à la date d’ouverture.";
  }

  return null;
}

function validatePublicationPayload(
  body,
  partial = false
) {
  const {
    duration,
    status,
    availableAt,
    closesAt,
  } = body || {};

  if (!partial || duration !== undefined) {
    if (
      !duration ||
      Number(duration) <= 0
    ) {
      return "La durée doit être supérieure à zéro.";
    }
  }

  if (
    status !== undefined &&
    !allowedStatuses.includes(status)
  ) {
    return "Le statut de la publication est invalide.";
  }

  return validateDates(
    availableAt,
    closesAt
  );
}

async function create(req, res, next) {
  try {
    const validationError =
      validatePublicationPayload(
        req.body
      );

    if (validationError) {
      return res.status(400).json({
        message: validationError,
      });
    }

    const publication =
      await publicationService.createPublication(
        req.params.evaluationId,
        req.userId,
        req.body
      );

    if (!publication) {
      return res.status(404).json({
        message: "Évaluation introuvable.",
      });
    }

    return res
      .status(201)
      .json(publication);
  } catch (error) {
    return next(error);
  }
}

async function getAll(req, res, next) {
  try {
    const publications =
      await publicationService.getPublications(req.userId);

    return res.json(publications);
  } catch (error) {
    return next(error);
  }
}

async function getByEvaluation(
  req,
  res,
  next
) {
  try {
    const publications =
      await publicationService.getPublicationsByEvaluation(
        req.params.evaluationId,
        req.userId
      );

    return res.json(publications);
  } catch (error) {
    return next(error);
  }
}

async function getOne(req, res, next) {
  try {
    const publication =
      await publicationService.getPublicationById(
        req.params.id,
        req.userId
      );

    if (!publication) {
      return res.status(404).json({
        message: "Publication introuvable.",
      });
    }

    return res.json(publication);
  } catch (error) {
    return next(error);
  }
}

async function getByCode(req, res, next) {
  try {
    const publication =
      await publicationService.getPublicationByCode(
        req.params.code
      );

    if (!publication) {
      return res.status(404).json({
        message:
          "Aucune publication ne correspond à ce code.",
      });
    }

    const now = new Date();

    if (
      publication.status !== "ACTIVE"
    ) {
      return res.status(403).json({
        message:
          "Cette publication n’est pas active.",
      });
    }

    if (
      publication.availableAt &&
      now <
        new Date(
          publication.availableAt
        )
    ) {
      return res.status(403).json({
        message:
          "Cette publication n’est pas encore disponible.",
      });
    }

    if (
      publication.closesAt &&
      now >
        new Date(
          publication.closesAt
        )
    ) {
      return res.status(403).json({
        message:
          "Cette publication est fermée.",
      });
    }

    return res.json({
      ...publication,
      evaluation: {
        ...publication.evaluation,
        questions: sanitizeQuestionsForStudent(
          publication.evaluation.questions
        ),
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const validationError =
      validatePublicationPayload(
        req.body
      );

    if (validationError) {
      return res.status(400).json({
        message: validationError,
      });
    }

    const publication =
      await publicationService.updatePublication(
        req.params.id,
        req.userId,
        req.body
      );

    if (!publication) {
      return res.status(404).json({
        message: "Publication introuvable.",
      });
    }

    return res.json(publication);
  } catch (error) {
    return next(error);
  }
}

async function updateStatus(
  req,
  res,
  next
) {
  try {
    const { status } = req.body || {};

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message:
          "Le statut demandé est invalide.",
      });
    }

    const publication =
      await publicationService.updatePublicationStatus(
        req.params.id,
        req.userId,
        status
      );

    if (!publication) {
      return res.status(404).json({
        message: "Publication introuvable.",
      });
    }

    return res.json(publication);
  } catch (error) {
    return next(error);
  }
}

async function regenerateCode(
  req,
  res,
  next
) {
  try {
    const publication =
      await publicationService.regeneratePublicationCode(
        req.params.id,
        req.userId
      );

    if (!publication) {
      return res.status(404).json({
        message: "Publication introuvable.",
      });
    }

    return res.json(publication);
  } catch (error) {
    return next(error);
  }
}

async function duplicate(req, res, next) {
  try {
    const publication =
      await publicationService.duplicatePublication(
        req.params.id,
        req.userId
      );

    if (!publication) {
      return res.status(404).json({
        message: "Publication introuvable.",
      });
    }

    return res
      .status(201)
      .json(publication);
  } catch (error) {
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    const publication =
      await publicationService.deletePublication(
        req.params.id,
        req.userId
      );

    if (!publication) {
      return res.status(404).json({
        message: "Publication introuvable.",
      });
    }

    return res.json({
      message:
        "Publication supprimée avec succès.",
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  create,
  getAll,
  getByEvaluation,
  getOne,
  getByCode,
  update,
  updateStatus,
  regenerateCode,
  duplicate,
  remove,
};