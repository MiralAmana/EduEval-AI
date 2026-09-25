const express = require("express");
const multer = require("multer");
const rateLimit = require("express-rate-limit");

const controller = require("../controllers/attempt.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const {
  getAttemptEvaluationType,
} = require("../services/attempt.service");

const router = express.Router();

// Une salle de classe (ou un opérateur mobile en CGNAT) partage une seule
// IP publique : toute limite par IP trop basse bloque la classe entière
// (250 élèves = 250 entrées depuis la même IP). Les limites côté élève
// sont donc calibrées pour ce cas, et l'abus est borné autrement :
//  - entrée : plafond par IP volontairement haut. Le code d'accès a
//    32^6 ≈ 1,07 milliard de combinaisons : à 1000 essais / 15 min, une IP
//    a environ 1 chance sur 10 000 par jour de tomber sur un code actif.
//    Ajustable via JOIN_RATE_LIMIT_PER_IP pour une très grande cohorte.
//  - actions : limite par tentative (identifiant cuid imprévisible, déjà
//    utilisé comme jeton d'accès), pas par IP.
//  - identifiants inconnus : plafond par IP sur les seules réponses 404,
//    pour empêcher de sonder des identifiants sans gêner une classe.
const joinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.JOIN_RATE_LIMIT_PER_IP) || 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Trop de tentatives d’accès. Réessaie plus tard.",
  },
});

// Compte uniquement les 404 (tentative ou question inconnue). Le limiteur
// compte aussi les requêtes en cours : le plafond doit rester au-dessus du
// nombre d'élèves d'une même IP qui agissent au même instant.
const unknownAttemptLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 600,
  skipSuccessfulRequests: true,
  requestWasSuccessful: (req, res) => res.statusCode !== 404,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Trop de requêtes. Réessaie dans quelques instants.",
  },
});

// Un élève qui tape sans arrêt déclenche au plus ~60 sauvegardes / minute
// (autosave après 800 ms d'inactivité) : 120 laisse de la marge pour les
// rechargements de page, et coupe une boucle folle côté client.
const attemptActionLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  keyGenerator: (req) => req.params.id,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Trop de requêtes. Réessaie dans quelques instants.",
  },
});

// Dépôts de fichiers (jusqu'à 10 Mo chacun) : plus coûteux, donc plus stricts.
const attemptUploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => req.params.id,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Trop de dépôts de fichiers. Réessaie dans quelques instants.",
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
router.get(
  "/:id",
  unknownAttemptLimiter,
  attemptActionLimiter,
  controller.getOne
);
router.put(
  "/:id/answers/:questionId",
  unknownAttemptLimiter,
  attemptActionLimiter,
  controller.saveAnswer
);
router.post(
  "/:id/answers/:questionId/file",
  unknownAttemptLimiter,
  attemptActionLimiter,
  attemptUploadLimiter,
  answerUpload.single("file"),
  controller.saveFileAnswer
);
router.post(
  "/:id/exit",
  unknownAttemptLimiter,
  attemptActionLimiter,
  controller.exit
);
router.post(
  "/:id/submit",
  unknownAttemptLimiter,
  attemptActionLimiter,
  controller.submit
);

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
