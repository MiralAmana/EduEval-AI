const { askAI } = require("../services/ai.service");
const {
  generateEvaluation,
} = require("../services/evaluationGeneration.service");

function validateGeneratePayload({ subject, questionCount, totalPoints }) {
  if (!subject || !String(subject).trim()) {
    return "Le sujet est obligatoire.";
  }

  const count = Number(questionCount);

  if (!count || count < 1 || count > 100) {
    return "Le nombre de questions doit être compris entre 1 et 100.";
  }

  const targetTotalPoints =
    totalPoints !== undefined && totalPoints !== null && totalPoints !== ""
      ? Number(totalPoints)
      : null;

  if (targetTotalPoints !== null && targetTotalPoints <= 0) {
    return "Le barème total doit être supérieur à zéro.";
  }

  return null;
}

async function test(req, res) {
  try {
    const response = await askAI(
      "Réponds uniquement par : Bonjour Charlize."
    );

    return res.json({ response });
  } catch (error) {
    return res.status(500).json({
      message: "Impossible de communiquer avec Groq.",
      error: error.response?.data || error.message,
    });
  }
}

async function generate(req, res, next) {
  try {
    const validationError = validateGeneratePayload(req.body || {});

    if (validationError) {
      return res.status(400).json({
        message: validationError,
      });
    }

    const evaluation = await generateEvaluation(req.body || {});

    return res.json({
      message: "Évaluation générée avec succès.",
      evaluation,
    });
  } catch (error) {
    if (error.status === 422) {
      return res.status(422).json({
        message: error.message,
        ...(error.rawResponse ? { rawResponse: error.rawResponse } : {}),
      });
    }

    return next(error);
  }
}

module.exports = {
  test,
  generate,
};
