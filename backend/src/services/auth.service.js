const crypto = require("node:crypto");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const prisma = require("../lib/prisma");
const { sendPasswordResetEmail } = require("./email.service");

const TOKEN_EXPIRES_IN = "7d";
const SALT_ROUNDS = 10;
const RESET_TOKEN_EXPIRES_IN_MS = 60 * 60 * 1000;

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error(
      "La variable JWT_SECRET est absente du fichier backend/.env."
    );
  }

  return process.env.JWT_SECRET;
}

function getFrontendUrl() {
  if (!process.env.FRONTEND_URL) {
    throw new Error(
      "La variable FRONTEND_URL est absente du fichier backend/.env."
    );
  }

  return process.env.FRONTEND_URL;
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function signToken(userId) {
  return jwt.sign({ sub: userId }, getJwtSecret(), {
    expiresIn: TOKEN_EXPIRES_IN,
  });
}

function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

function sanitizeUser(user) {
  const { password, ...safeUser } = user;

  return safeUser;
}

async function register({ firstName, lastName, email, password }) {
  const existingUser = await prisma.user.findUnique({
    where: {
      email: email.toLowerCase().trim(),
    },
  });

  if (existingUser) {
    const error = new Error("Un compte existe déjà avec cet email.");
    error.status = 409;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
    },
  });

  const token = signToken(user.id);

  return {
    user: sanitizeUser(user),
    token,
  };
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({
    where: {
      email: String(email).toLowerCase().trim(),
    },
  });

  const invalidCredentialsError = new Error(
    "Email ou mot de passe incorrect."
  );
  invalidCredentialsError.status = 401;

  if (!user) {
    throw invalidCredentialsError;
  }

  const passwordMatches = await bcrypt.compare(password, user.password);

  if (!passwordMatches) {
    throw invalidCredentialsError;
  }

  const token = signToken(user.id);

  return {
    user: sanitizeUser(user),
    token,
  };
}

async function getUserById(userId) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  return user ? sanitizeUser(user) : null;
}

async function requestPasswordReset(email) {
  const user = await prisma.user.findUnique({
    where: {
      email: String(email).toLowerCase().trim(),
    },
  });

  if (!user) {
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");

  await prisma.user.update({
    where: {
      id: user.id,
    },

    data: {
      resetPasswordTokenHash: hashResetToken(token),
      resetPasswordExpiresAt: new Date(Date.now() + RESET_TOKEN_EXPIRES_IN_MS),
    },
  });

  const resetLink = `${getFrontendUrl()}/reset-password?token=${token}`;

  await sendPasswordResetEmail({
    to: user.email,
    firstName: user.firstName,
    resetLink,
  });
}

async function resetPassword(token, newPassword) {
  const user = await prisma.user.findFirst({
    where: {
      resetPasswordTokenHash: hashResetToken(String(token)),
      resetPasswordExpiresAt: {
        gt: new Date(),
      },
    },
  });

  if (!user) {
    const error = new Error(
      "Ce lien de réinitialisation est invalide ou expiré."
    );
    error.status = 400;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.user.update({
    where: {
      id: user.id,
    },

    data: {
      password: hashedPassword,
      resetPasswordTokenHash: null,
      resetPasswordExpiresAt: null,
    },
  });
}

module.exports = {
  register,
  login,
  getUserById,
  verifyToken,
  requestPasswordReset,
  resetPassword,
};
