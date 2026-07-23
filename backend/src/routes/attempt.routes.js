const express = require("express");
const multer = require("multer");

const controller = require("../controllers/attempt.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

const answerUpload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

// Routes publiques empruntées par les étudiants (l'identifiant de
// tentative, imprévisible, fait office de jeton d'accès).
router.post("/join", controller.join);
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

module.exports = router;
