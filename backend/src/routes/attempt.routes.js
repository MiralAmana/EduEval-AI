const express = require("express");
const multer = require("multer");
const rateLimit = require("express-rate-limit");

const controller = require("../controllers/attempt.controller");
const { requireAuth } = require("../middleware/auth.middleware");

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

const answerUpload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024,
  },

  fileFilter(req, file, callback) {
    if (!ALLOWED_ANSWER_FILE_TYPES.has(file.mimetype)) {
      const error = new Error(
        "Type de fichier non autorisé. Formats acceptés : PDF, Word, Excel, PowerPoint, texte, JPG, PNG."
      );
      error.status = 400;

      return callback(error);
    }

    return callback(null, true);
  },
});

// Routes publiques empruntées par les étudiants (l'identifiant de
// tentative, imprévisible, fait office de jeton d'accès).
router.post("/join", joinLimiter, controller.join);
router.get("/:id", controller.getOne);
router.put("/:id/answers/:questionId", controller.saveAnswer);
router.post(
  "/:id/answers/:questionId/file",
  answerUpload.single("file"),
  controller.saveFileAnswer
);
router.post("/:id/exit", controller.exit);
router.post("/:id/submit", controller.submit);

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

module.exports = router;
