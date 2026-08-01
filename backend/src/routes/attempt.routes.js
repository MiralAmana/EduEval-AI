const express = require("express");
const multer = require("multer");
const rateLimit = require("express-rate-limit");

const controller = require("../controllers/attempt.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const {
  getAttemptEvaluationType,
} = require("../services/attempt.service");

const router = express.Router();

const joinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Trop de tentatives d’accès. Réessaie plus tard.",
  },
});

// Les routes étudiantes n'étant pas authentifiées (voir commentaire
// plus bas), elles restent exposées à un abus par IP sans limite dédiée.
const attemptActionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Trop de requêtes. Réessaie dans quelques instants.",
  },
});

const ALLOWED_ANSWER_FILE_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "image/jpeg",
  "image/png",
]);

const TYPE_SPECIFIC_ALLOWED_FILE_TYPES = {
  WORD: {
    mimeTypes: new Set([
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]),
    label: "Word (.doc, .docx)",
  },

  EXCEL: {
    mimeTypes: new Set([
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]),
    label: "Excel (.xls, .xlsx)",
  },

  POWERPOINT: {
    mimeTypes: new Set([
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ]),
    label: "PowerPoint (.ppt, .pptx)",
  },
};

const answerUpload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024,
  },

  async fileFilter(req, file, callback) {
    try {
      const evaluationType = await getAttemptEvaluationType(req.params.id);
      const typeConfig = TYPE_SPECIFIC_ALLOWED_FILE_TYPES[evaluationType];

      if (typeConfig) {
        if (!typeConfig.mimeTypes.has(file.mimetype)) {
          const error = new Error(
            `Cette évaluation nécessite un fichier ${typeConfig.label}.`
          );
          error.status = 400;

          return callback(error);
        }

        return callback(null, true);
      }

      if (!ALLOWED_ANSWER_FILE_TYPES.has(file.mimetype)) {
        const error = new Error(
          "Type de fichier non autorisé. Formats acceptés : PDF, Word, Excel, PowerPoint, texte, JPG, PNG."
        );
        error.status = 400;

        return callback(error);
      }

      return callback(null, true);
    } catch (error) {
      return callback(error);
    }
  },
});

// Routes publiques empruntées par les étudiants (l'identifiant de
// tentative, imprévisible, fait office de jeton d'accès).
router.post("/join", joinLimiter, controller.join);
router.get("/:id", attemptActionLimiter, controller.getOne);
router.put(
  "/:id/answers/:questionId",
  attemptActionLimiter,
  controller.saveAnswer
);
router.post(
  "/:id/answers/:questionId/file",
  attemptActionLimiter,
  answerUpload.single("file"),
  controller.saveFileAnswer
);
router.post("/:id/exit", attemptActionLimiter, controller.exit);
router.post("/:id/submit", attemptActionLimiter, controller.submit);

// Routes de correction réservées à l'enseignant propriétaire.
router.get("/:id/review", requireAuth, controller.review);
router.put(
  "/:id/answers/:questionId/grade",
  requireAuth,
  controller.gradeAnswer
);
router.post(
  "/:id/answers/:questionId/grade-ai",
  requireAuth,
  controller.gradeAnswerWithAi
);
router.post("/:id/publish", requireAuth, controller.publish);
router.get(
  "/:id/answers/:questionId/file",
  requireAuth,
  controller.downloadAnswerFile
);
router.get(
  "/:id/answers/:questionId/preview",
  requireAuth,
  controller.previewAnswerFile
);

module.exports = router;
