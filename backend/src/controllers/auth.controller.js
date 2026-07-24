const authService = require("../services/auth.service");

function validateRegisterPayload({ firstName, lastName, email, password }) {
  if (!firstName || !String(firstName).trim()) {
    return "Le prénom est obligatoire.";
  }

  if (!lastName || !String(lastName).trim()) {
    return "Le nom est obligatoire.";
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
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

module.exports = {
  register,
  login,
  logout,
  me,
};
