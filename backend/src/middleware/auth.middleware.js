const authService = require("../services/auth.service");

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;

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
};
