const authService = require("../services/auth.service");

const COOKIE_NAME = "token";

function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];

  if (!token) {
    return res.status(401).json({
      message: "Authentification requise.",
    });
  }

  try {
    const payload = authService.verifyToken(token);

    req.userId = payload.sub;

    return next();
  } catch {
    return res.status(401).json({
      message: "Session invalide ou expirée.",
    });
  }
}

module.exports = {
  requireAuth,
  COOKIE_NAME,
};
