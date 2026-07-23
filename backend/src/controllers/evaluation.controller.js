const evaluationService = require(
  "../services/evaluation.service"
);

const allowedContentTypes = [
  "EXERCISE",
  "EVALUATION",
];

const allowedEvaluationTypes = [
  "CLASSIC",
  "WORD",
  "EXCEL",
  "POWERPOINT",
  "MIXED",
];

const allowedStatuses = [
  "DRAFT",
  "ACTIVE",
  "DISABLED",
  "FINISHED",
];

const allowedQuestionTypes = [
  "QCM",
  "SHORT_TEXT",
  "LONG_TEXT",
  "FILE_UPLOAD",
];

function validateEvaluationPayload(body, partial = false) {
  const {
    title,
    duration,
    contentType,
    type,
    status,
    questions,
  } = body || {};

  if (!partial || title !== undefined) {
    if (!title || !String(title).trim()) {
      return "Le titre est obligatoire.";
    }
  }

  if (!partial || duration !== undefined) {
    if (!duration || Number(duration) <= 0) {
      return "La durée doit être supérieure à zéro.";
    }
  }

  if (
    contentType !== undefined &&
    !allowedContentTypes.includes(contentType)
  ) {
    return "Le type de contenu est invalide.";
  }

  if (
    type !== undefined &&
    !allowedEvaluationTypes.includes(type)
  ) {
    return "Le type d’évaluation est invalide.";
  }

  if (
    status !== undefined &&
    !allowedStatuses.includes(status)
  ) {
    return "Le statut est invalide.";
  }

  if (
    questions !== undefined &&
    !Array.isArray(questions)
  ) {
    return "La propriété questions doit être un tableau.";
  }

  for (const [index, question] of (
    questions || []
  ).entries()) {
    if (
      !question.statement ||
      !String(question.statement).trim()
    ) {
      return `L’énoncé de la question ${
        index + 1
      } est obligatoire.`;
    }

    if (
      !allowedQuestionTypes.includes(question.type)
    ) {
      return `Le type de la question ${
        index + 1
      } est invalide.`;
    }

    if (
      question.type === "QCM" &&
      (!Array.isArray(question.choices) ||
        question.choices.filter((choice) =>
          String(choice).trim()
        ).length < 2)
    ) {
      return `La question ${
        index + 1
      } doit contenir au moins deux choix.`;
    }

    if (Number(question.points) < 0) {
      return `Les points de la question ${
        index + 1
      } sont invalides.`;
    }
  }

  return null;
}

async function create(req, res, next) {
  try {
    const validationError =
      validateEvaluationPayload(req.body);

    if (validationError) {
      return res.status(400).json({
        message: validationError,
      });
    }

    const evaluation =
      await evaluationService.createEvaluation(
        {
          ...req.body,
          title: String(req.body.title).trim(),
        },
        req.userId
      );

    return res.status(201).json(evaluation);
  } catch (error) {
    return next(error);
  }
}

async function getAll(req, res, next) {
  try {
    const evaluations =
      await evaluationService.getEvaluations(req.userId);

    return res.json(evaluations);
  } catch (error) {
    return next(error);
  }
}

async function getOne(req, res, next) {
  try {
    const evaluation =
      await evaluationService.getEvaluationById(
        req.params.id,
        req.userId
      );

    if (!evaluation) {
      return res.status(404).json({
        message: "Évaluation introuvable.",
      });
    }

    return res.json(evaluation);
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const validationError =
      validateEvaluationPayload(req.body);

    if (validationError) {
      return res.status(400).json({
        message: validationError,
      });
    }

    const evaluation =
      await evaluationService.updateEvaluation(
        req.params.id,
        req.userId,
        {
          ...req.body,
          title: String(req.body.title).trim(),
        }
      );

    if (!evaluation) {
      return res.status(404).json({
        message: "Évaluation introuvable.",
      });
    }

    return res.json(evaluation);
  } catch (error) {
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    const evaluation =
      await evaluationService.deleteEvaluation(
        req.params.id,
        req.userId
      );

    if (!evaluation) {
      return res.status(404).json({
        message: "Évaluation introuvable.",
      });
    }

    return res.json({
      message: "Évaluation supprimée avec succès.",
    });
  } catch (error) {
    return next(error);
  }
}

async function updateStatus(req, res, next) {
  try {
    const { status } = req.body || {};

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Le statut demandé est invalide.",
      });
    }

    const evaluation =
      await evaluationService.updateEvaluationStatus(
        req.params.id,
        req.userId,
        status
      );

    if (!evaluation) {
      return res.status(404).json({
        message: "Évaluation introuvable.",
      });
    }

    return res.json(evaluation);
  } catch (error) {
    return next(error);
  }
}

async function duplicate(req, res, next) {
  try {
    const evaluation =
      await evaluationService.duplicateEvaluation(
        req.params.id,
        req.userId
      );

    if (!evaluation) {
      return res.status(404).json({
        message: "Évaluation introuvable.",
      });
    }

    return res.status(201).json(evaluation);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  create,
  getAll,
  getOne,
  update,
  remove,
  updateStatus,
  duplicate,
};