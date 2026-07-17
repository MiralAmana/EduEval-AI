const express = require("express");

const controller = require(
  "../controllers/evaluation.controller"
);

const router = express.Router();

router.get("/", controller.getAll);

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

module.exports = router;