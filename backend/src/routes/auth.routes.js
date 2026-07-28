const express = require("express");
const rateLimit = require("express-rate-limit");

const controller = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Trop de comptes créés depuis cette adresse. Réessaie plus tard.",
  },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Trop de tentatives de connexion. Réessaie dans quelques minutes.",
  },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Trop de demandes de réinitialisation. Réessaie plus tard.",
  },
});

router.post("/register", registerLimiter, controller.register);
router.post("/login", loginLimiter, controller.login);
router.post("/logout", controller.logout);
router.get("/me", requireAuth, controller.me);
router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  controller.forgotPassword
);
router.post("/reset-password", controller.resetPassword);

module.exports = router;
