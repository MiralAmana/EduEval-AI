const authService = require("../services/auth.service");

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function validateRegisterPayload({ firstName, lastName, email, password }) {
  if (!firstName || !String(firstName).trim()) {
    return "Le prénom est obligatoire.";
  }

  if (!lastName || !String(lastName).trim()) {
    return "Le nom est obligatoire.";
  }

  if (!email || !isValidEmail(email)) {
    return "L’email est invalide.";
  }

  if (!password || String(password).length < 8) {
    return "Le mot de passe doit contenir au moins 8 caractères.";
  }

  return null;
}

async function register(req, res, next) {
  try {
    const validationError = validateRegisterPayload(req.body || {});

    if (validationError) {
      return res.status(400).json({
        message: validationError,
      });
    }

    const { user, token } = await authService.register(req.body);

    return res.status(201).json({ user, token });
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        message: "L’email et le mot de passe sont obligatoires.",
      });
    }

    const { user, token } = await authService.login({
      email,
      password,
    });

    return res.json({ user, token });
  } catch (error) {
    return next(error);
  }
}

function logout(req, res) {
  return res.json({
    message: "Déconnexion réussie.",
  });
}

async function me(req, res, next) {
  try {
    const user = await authService.getUserById(req.userId);

    if (!user) {
      return res.status(404).json({
        message: "Utilisateur introuvable.",
      });
    }

    return res.json({ user });
  } catch (error) {
    return next(error);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body || {};

    if (!isValidEmail(email)) {
      return res.status(400).json({
        message: "L’email est invalide.",
      });
    }

    await authService.requestPasswordReset(email);

    return res.json({
      message:
        "Si un compte existe avec cet email, un lien de réinitialisation vient d’être envoyé.",
    });
  } catch (error) {
    return next(error);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body || {};

    if (!token) {
      return res.status(400).json({
        message: "Le lien de réinitialisation est invalide.",
      });
    }

    if (!password || String(password).length < 8) {
      return res.status(400).json({
        message: "Le mot de passe doit contenir au moins 8 caractères.",
      });
    }

    await authService.resetPassword(token, password);

    return res.json({
      message: "Mot de passe mis à jour.",
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  register,
  login,
  logout,
  me,
  forgotPassword,
  resetPassword,
};
