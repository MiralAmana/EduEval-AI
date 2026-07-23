const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const prisma = require("../lib/prisma");

const TOKEN_EXPIRES_IN = "7d";
const SALT_ROUNDS = 10;

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error(
      "La variable JWT_SECRET est absente du fichier backend/.env."
    );
  }

  return process.env.JWT_SECRET;
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

module.exports = {
  register,
  login,
  getUserById,
  verifyToken,
};
