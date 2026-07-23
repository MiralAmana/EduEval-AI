const express = require("express");

const controller = require(
  "../controllers/publication.controller"
);
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.get(
  "/code/:code",
  controller.getByCode
);

router.use(requireAuth);

router.get(
  "/",
  controller.getAll
);

router.get(
  "/evaluation/:evaluationId",
  controller.getByEvaluation
);

router.post(
  "/evaluation/:evaluationId",
  controller.create
);

router.get(
  "/:id",
  controller.getOne
);

router.put(
  "/:id",
  controller.update
);

router.patch(
  "/:id/status",
  controller.updateStatus
);

router.patch(
  "/:id/regenerate-code",
  controller.regenerateCode
);

router.post(
  "/:id/duplicate",
  controller.duplicate
);

router.delete(
  "/:id",
  controller.remove
);

module.exports = router;