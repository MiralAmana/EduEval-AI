const express = require("express");

const controller = require(
  "../controllers/evaluation.controller"
);
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(requireAuth);

router.get("/", controller.getAll);

// Avant "/:id" : sinon "participants" serait pris pour un identifiant.
router.get("/participants", controller.getParticipants);

router.post("/", controller.create);

router.get("/:id", controller.getOne);

router.put("/:id", controller.update);

router.delete("/:id", controller.remove);

router.patch(
  "/:id/status",
  controller.updateStatus
);

router.post(
  "/:id/duplicate",
  controller.duplicate
);

router.get(
  "/:id/questions/:questionId/answers",
  controller.getQuestionAnswers
);

module.exports = router;