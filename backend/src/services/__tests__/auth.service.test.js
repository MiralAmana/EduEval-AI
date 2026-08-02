const crypto = require("node:crypto");

jest.mock("../../lib/prisma", () => ({
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock("jsonwebtoken", () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

jest.mock("../email.service", () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

const prisma = require("../../lib/prisma");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sendPasswordResetEmail } = require("../email.service");
const authService = require("../auth.service");

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  process.env.JWT_SECRET = "test-secret";
  process.env.FRONTEND_URL = "http://localhost:5173";
  jwt.sign.mockReturnValue("signed-token");
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("register", () => {
  const payload = {
    firstName: "  Ada  ",
    lastName: "  Lovelace  ",
    email: "  Ada@Example.com  ",
    password: "hunter2",
  };

  it("rejette avec 409 si un compte existe déjà pour cet email", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "user-1" });

    await expect(authService.register(payload)).rejects.toMatchObject({
      status: 409,
    });

    expect(bcrypt.hash).not.toHaveBeenCalled();
  });

  it("normalise l'email et les noms, hash le mot de passe, et renvoie un utilisateur sans mot de passe", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue("hashed-password");
    prisma.user.create.mockResolvedValue({
      id: "user-1",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      password: "hashed-password",
    });

    const result = await authService.register(payload);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "ada@example.com" },
    });
    expect(bcrypt.hash).toHaveBeenCalledWith("hunter2", 10);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        password: "hashed-password",
      },
    });
    expect(result.user).not.toHaveProperty("password");
    expect(result.token).toBe("signed-token");
  });
});

describe("login", () => {
  it("rejette avec 401 si l'utilisateur n'existe pas", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      authService.login({ email: "x@example.com", password: "pw" })
    ).rejects.toMatchObject({ status: 401 });

    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it("rejette avec 401 si le mot de passe est incorrect", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      password: "hashed",
    });
    bcrypt.compare.mockResolvedValue(false);

    await expect(
      authService.login({ email: "x@example.com", password: "wrong" })
    ).rejects.toMatchObject({ status: 401 });
  });

  it("renvoie l'utilisateur sans mot de passe et un token en cas de succès", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      password: "hashed",
    });
    bcrypt.compare.mockResolvedValue(true);

    const result = await authService.login({
      email: "  Ada@Example.com  ",
      password: "hunter2",
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "ada@example.com" },
    });
    expect(result.user).not.toHaveProperty("password");
    expect(result.token).toBe("signed-token");
  });

  it("renvoie le même message d'erreur pour un email inconnu et un mot de passe erroné", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    let unknownEmailError;

    try {
      await authService.login({ email: "x@example.com", password: "pw" });
    } catch (error) {
      unknownEmailError = error;
    }

    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      password: "hashed",
    });
    bcrypt.compare.mockResolvedValue(false);

    let wrongPasswordError;

    try {
      await authService.login({ email: "x@example.com", password: "pw" });
    } catch (error) {
      wrongPasswordError = error;
    }

    // Ne pas laisser un attaquant distinguer "email inconnu" de "mauvais
    // mot de passe" à partir du message renvoyé.
    expect(unknownEmailError.message).toBe(wrongPasswordError.message);
  });
});

describe("getUserById", () => {
  it("renvoie null si l'utilisateur n'existe pas", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await authService.getUserById("user-1");

    expect(result).toBeNull();
  });

  it("renvoie l'utilisateur sans mot de passe", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      password: "hashed",
    });

    const result = await authService.getUserById("user-1");

    expect(result).not.toHaveProperty("password");
    expect(result.id).toBe("user-1");
  });
});

describe("requestPasswordReset", () => {
  it("ne fait rien et n'envoie aucun email si l'email est inconnu (pas de fuite d'information)", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await authService.requestPasswordReset("inconnu@example.com");

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("stocke un hash du token et envoie un email contenant le token en clair, cohérent avec le hash stocké", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      firstName: "Ada",
    });
    prisma.user.update.mockResolvedValue({});

    await authService.requestPasswordReset("ada@example.com");

    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    const updateData = prisma.user.update.mock.calls[0][0].data;

    expect(updateData.resetPasswordTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(updateData.resetPasswordExpiresAt).toBeInstanceOf(Date);

    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    const emailArgs = sendPasswordResetEmail.mock.calls[0][0];

    expect(emailArgs.to).toBe("ada@example.com");
    expect(emailArgs.resetLink).toMatch(
      /^http:\/\/localhost:5173\/reset-password\?token=/
    );

    const rawToken = new URL(emailArgs.resetLink).searchParams.get("token");
    const expectedHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    expect(updateData.resetPasswordTokenHash).toBe(expectedHash);
  });
});

describe("resetPassword", () => {
  it("rejette avec 400 si aucun utilisateur ne correspond au token (invalide ou expiré)", async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      authService.resetPassword("un-token", "nouveauMotDePasse")
    ).rejects.toMatchObject({ status: 400 });

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("recherche uniquement un token non expiré", async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await authService
      .resetPassword("un-token", "nouveauMotDePasse")
      .catch(() => {});

    const where = prisma.user.findFirst.mock.calls[0][0].where;

    expect(where.resetPasswordExpiresAt.gt).toBeInstanceOf(Date);
  });

  it("met à jour le mot de passe et efface le token de réinitialisation", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "user-1" });
    bcrypt.hash.mockResolvedValue("hashed-new-password");
    prisma.user.update.mockResolvedValue({});

    await authService.resetPassword("un-token", "nouveauMotDePasse");

    expect(bcrypt.hash).toHaveBeenCalledWith("nouveauMotDePasse", 10);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        password: "hashed-new-password",
        resetPasswordTokenHash: null,
        resetPasswordExpiresAt: null,
      },
    });
  });
});
