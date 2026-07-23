const attemptService = require("../services/attempt.service");

function validateJoinPayload({ code, firstName, lastName, email }) {
  if (!code || !String(code).trim()) {
    return "Le code de l’évaluation est obligatoire.";
  }

  if (!firstName || !String(firstName).trim()) {
    return "Le prénom est obligatoire.";
  }

  if (!lastName || !String(lastName).trim()) {
    return "Le nom est obligatoire.";
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    return "L’email est invalide.";
  }

  return null;
}

async function join(req, res, next) {
  try {
    const validationError = validateJoinPayload(req.body || {});

    if (validationError) {
      return res.status(400).json({
        message: validationError,
      });
    }

    const payload = await attemptService.joinPublication(req.body);

    return res.status(201).json(payload);
  } catch (error) {
    return next(error);
  }
}

async function getOne(req, res, next) {
  try {
    const payload = await attemptService.getAttempt(req.params.id);

    if (!payload) {
      return res.status(404).json({
        message: "Tentative introuvable.",
      });
    }

    return res.json(payload);
  } catch (error) {
    return next(error);
  }
}

async function saveAnswer(req, res, next) {
  try {
    const { textAnswer } = req.body || {};

    const payload = await attemptService.saveTextAnswer(
      req.params.id,
      req.params.questionId,
      textAnswer
    );

    return res.json(payload);
  } catch (error) {
    return next(error);
  }
}

async function saveFileAnswer(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Aucun fichier envoyé.",
      });
    }

    const payload = await attemptService.saveFileAnswer(
      req.params.id,
      req.params.questionId,
      req.file.path,
      req.file.originalname
    );

    return res.json(payload);
  } catch (error) {
    return next(error);
  }
}

async function exit(req, res, next) {
  try {
    const payload = await attemptService.registerExit(req.params.id);

    return res.json(payload);
  } catch (error) {
    return next(error);
  }
}

async function submit(req, res, next) {
  try {
    const payload = await attemptService.submitAttempt(req.params.id);

    return res.json(payload);
  } catch (error) {
    return next(error);
  }
}

async function review(req, res, next) {
  try {
    const payload = await attemptService.getAttemptForReview(
      req.params.id,
      req.userId
    );

    if (!payload) {
      return res.status(404).json({
        message: "Tentative introuvable.",
      });
    }

    return res.json(payload);
  } catch (error) {
    return next(error);
  }
}

async function gradeAnswer(req, res, next) {
  try {
    const { score, feedback } = req.body || {};

    if (score === undefined || score === null || Number.isNaN(Number(score))) {
      return res.status(400).json({
        message: "La note est obligatoire.",
      });
    }

    const payload = await attemptService.gradeAnswerManually(
      req.params.id,
      req.params.questionId,
      req.userId,
      { score, feedback }
    );

    return res.json(payload);
  } catch (error) {
    return next(error);
  }
}

async function gradeAnswerWithAi(req, res, next) {
  try {
    const payload = await attemptService.gradeAnswerWithAiAssist(
      req.params.id,
      req.params.questionId,
      req.userId
    );

    return res.json(payload);
  } catch (error) {
    return next(error);
  }
}

async function publish(req, res, next) {
  try {
    const payload = await attemptService.publishResults(
      req.params.id,
      req.userId
    );

    return res.json(payload);
  } catch (error) {
    return next(error);
  }
}

async function downloadAnswerFile(req, res, next) {
  try {
    const { filePath, fileName } =
      await attemptService.getAnswerFileForTeacher(
        req.params.id,
        req.params.questionId,
        req.userId
      );

    return res.download(filePath, fileName);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  join,
  getOne,
  saveAnswer,
  saveFileAnswer,
  exit,
  submit,
  review,
  gradeAnswer,
  gradeAnswerWithAi,
  publish,
  downloadAnswerFile,
};
