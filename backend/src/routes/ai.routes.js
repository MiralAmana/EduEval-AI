const express = require("express");
const rateLimit = require("express-rate-limit");

const controller = require("../controllers/ai.controller");

const router = express.Router();

// Protège le coût des appels Groq contre un abus (endpoint sans
// authentification requise à ce jour).
const generateEvaluationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Trop de générations demandées. Réessaie plus tard.",
  },
});

router.get("/test", controller.test);
router.post(
  "/generate-evaluation",
  generateEvaluationLimiter,
  controller.generate
);

module.exports = router;
