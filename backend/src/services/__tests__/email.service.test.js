const mockSend = jest.fn();

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

const ORIGINAL_ENV = { ...process.env };

const OK = { data: { id: "email-1" }, error: null, headers: {} };

function failure(statusCode, name, message = "erreur", headers = {}) {
  return { data: null, error: { name, message, statusCode }, headers };
}

// Chaque test repart d'un module neuf : la file d'envoi et la pause de quota
// vivent dans l'état du module.
function loadEmailService() {
  let service;

  jest.isolateModules(() => {
    service = require("../email.service");
  });

  return service;
}

const RESULT_ARGS = {
  to: "eleve@example.com",
  firstName: "Ada",
  evaluationTitle: "Examen",
  score: 12,
  maxScore: 20,
};

beforeEach(() => {
  mockSend.mockReset().mockResolvedValue(OK);
  process.env = {
    ...ORIGINAL_ENV,
    RESEND_API_KEY: "test-key",
    EMAIL_MIN_INTERVAL_MS: "0",
    EMAIL_RETRY_BASE_MS: "0",
  };
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("contenu des emails", () => {
  it("échappe le HTML du prénom et du titre dans l'email de résultats", async () => {
    const { sendResultsPublishedEmail } = loadEmailService();

    await sendResultsPublishedEmail({
      ...RESULT_ARGS,
      firstName: '<img src=x onerror="alert(1)">',
      evaluationTitle: "<a href='http://evil.example'>Clique</a>",
    });

    const [{ html }] = mockSend.mock.calls[0];

    expect(html).not.toContain("<img");
    expect(html).not.toContain("<a href='http://evil.example'>");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("12 / 20");
  });

  it("échappe le prénom et garde un lien de réinitialisation fonctionnel", async () => {
    const { sendPasswordResetEmail } = loadEmailService();

    await sendPasswordResetEmail({
      to: "prof@example.com",
      firstName: "<script>alert(1)</script>",
      resetLink: "https://app.example/reset-password?token=abc123",
    });

    const [{ html }] = mockSend.mock.calls[0];

    expect(html).not.toContain("<script>");
    expect(html).toContain(
      'href="https://app.example/reset-password?token=abc123"'
    );
  });

  it("utilise RESEND_FROM_EMAIL quand il est défini, sinon l'expéditeur de test", async () => {
    process.env.RESEND_FROM_EMAIL = "EduEval <no-reply@mon-domaine.sn>";
    await loadEmailService().sendResultsPublishedEmail(RESULT_ARGS);

    delete process.env.RESEND_FROM_EMAIL;
    await loadEmailService().sendResultsPublishedEmail(RESULT_ARGS);

    expect(mockSend.mock.calls[0][0].from).toBe(
      "EduEval <no-reply@mon-domaine.sn>"
    );
    expect(mockSend.mock.calls[1][0].from).toContain("onboarding@resend.dev");
  });
});

describe("erreurs renvoyées par Resend (le SDK ne lève pas d'exception)", () => {
  it("rejette quand Resend refuse l'envoi, sans réessayer une erreur définitive (403 domaine de test)", async () => {
    mockSend.mockResolvedValue(
      failure(
        403,
        "validation_error",
        "You can only send testing emails to your own email address"
      )
    );

    const { sendResultsPublishedEmail } = loadEmailService();

    await expect(
      sendResultsPublishedEmail(RESULT_ARGS)
    ).rejects.toMatchObject({
      name: "EmailSendError",
      statusCode: 403,
      resendName: "validation_error",
      message: expect.stringContaining("your own email address"),
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("réessaie sur une limite de débit (429) puis réussit, avec la même clé d'idempotence", async () => {
    mockSend
      .mockResolvedValueOnce(failure(429, "rate_limit_exceeded"))
      .mockResolvedValueOnce(failure(429, "rate_limit_exceeded"))
      .mockResolvedValueOnce(OK);

    const { sendResultsPublishedEmail } = loadEmailService();

    await expect(sendResultsPublishedEmail(RESULT_ARGS)).resolves.toEqual({
      id: "email-1",
    });
    expect(mockSend).toHaveBeenCalledTimes(3);

    const keys = mockSend.mock.calls.map(([, options]) => options.idempotencyKey);

    expect(keys[0]).toEqual(expect.any(String));
    expect(new Set(keys).size).toBe(1);
  });

  it("réessaie une panne réseau (pas de statut) puis réussit", async () => {
    mockSend
      .mockResolvedValueOnce(failure(null, "application_error", "fetch failed"))
      .mockResolvedValueOnce(OK);

    const { sendResultsPublishedEmail } = loadEmailService();

    await expect(sendResultsPublishedEmail(RESULT_ARGS)).resolves.toBeDefined();
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("abandonne après 4 essais au total sur une panne persistante (500)", async () => {
    mockSend.mockResolvedValue(failure(500, "internal_server_error"));

    const { sendResultsPublishedEmail } = loadEmailService();

    await expect(sendResultsPublishedEmail(RESULT_ARGS)).rejects.toMatchObject({
      statusCode: 500,
    });
    expect(mockSend).toHaveBeenCalledTimes(4);
  });

  it("suspend les envois une fois le quota atteint, sans rappeler l'API", async () => {
    mockSend.mockResolvedValue(failure(429, "daily_quota_exceeded"));

    const { sendResultsPublishedEmail } = loadEmailService();

    await expect(sendResultsPublishedEmail(RESULT_ARGS)).rejects.toMatchObject({
      resendName: "daily_quota_exceeded",
    });
    expect(mockSend).toHaveBeenCalledTimes(1); // pas de réessai sur un quota

    await expect(sendResultsPublishedEmail(RESULT_ARGS)).rejects.toMatchObject({
      resendName: "quota_blocked",
    });
    await expect(sendResultsPublishedEmail(RESULT_ARGS)).rejects.toMatchObject({
      resendName: "quota_blocked",
    });
    expect(mockSend).toHaveBeenCalledTimes(1); // aucun appel de plus
  });

  it("reprend les envois après la pause de quota", async () => {
    jest.useFakeTimers();
    mockSend.mockResolvedValueOnce(failure(429, "monthly_quota_exceeded"));

    const { sendResultsPublishedEmail } = loadEmailService();

    await expect(sendResultsPublishedEmail(RESULT_ARGS)).rejects.toBeDefined();

    jest.advanceTimersByTime(61 * 60 * 1000);
    mockSend.mockResolvedValue(OK);

    await expect(sendResultsPublishedEmail(RESULT_ARGS)).resolves.toBeDefined();
  });
});

describe("cadence d'envoi", () => {
  it("espace les envois d'au moins EMAIL_MIN_INTERVAL_MS", async () => {
    jest.useFakeTimers();
    process.env.EMAIL_MIN_INTERVAL_MS = "200";

    const { sendResultsPublishedEmail } = loadEmailService();
    const sent = [1, 2, 3].map(() => sendResultsPublishedEmail(RESULT_ARGS));

    await jest.advanceTimersByTimeAsync(0);
    expect(mockSend).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(199);
    expect(mockSend).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    expect(mockSend).toHaveBeenCalledTimes(2);

    await jest.advanceTimersByTimeAsync(200);
    expect(mockSend).toHaveBeenCalledTimes(3);

    await Promise.all(sent);
  });

  it("place un email de réinitialisation de mot de passe devant les emails de résultats en attente", async () => {
    jest.useFakeTimers();
    process.env.EMAIL_MIN_INTERVAL_MS = "200";

    const { sendResultsPublishedEmail, sendPasswordResetEmail } =
      loadEmailService();

    const sent = [
      sendResultsPublishedEmail(RESULT_ARGS),
      sendResultsPublishedEmail(RESULT_ARGS),
      sendResultsPublishedEmail(RESULT_ARGS),
      sendPasswordResetEmail({
        to: "prof@example.com",
        firstName: "Prof",
        resetLink: "https://app.example/reset?token=t",
      }),
    ];

    await jest.advanceTimersByTimeAsync(1000);
    await Promise.all(sent);

    const subjects = mockSend.mock.calls.map(([payload]) => payload.subject);

    // Le 1er email de résultats était déjà parti ; la réinitialisation passe
    // avant les deux suivants.
    expect(subjects[0]).toContain("Votre note");
    expect(subjects[1]).toContain("Réinitialisation");
    expect(subjects.slice(2).every((s) => s.includes("Votre note"))).toBe(true);
  });

  it("un envoi en échec ne bloque pas les suivants", async () => {
    mockSend
      .mockResolvedValueOnce(failure(403, "validation_error"))
      .mockResolvedValueOnce(OK);

    const { sendResultsPublishedEmail } = loadEmailService();

    const results = await Promise.allSettled([
      sendResultsPublishedEmail(RESULT_ARGS),
      sendResultsPublishedEmail(RESULT_ARGS),
    ]);

    expect(results.map((result) => result.status)).toEqual([
      "rejected",
      "fulfilled",
    ]);
  });
});

describe("warnIfUsingTestSender", () => {
  it("avertit quand RESEND_FROM_EMAIL n'est pas défini", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    delete process.env.RESEND_FROM_EMAIL;

    expect(loadEmailService().warnIfUsingTestSender()).toBe(true);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("RESEND_FROM_EMAIL")
    );
  });

  it("reste silencieux quand un expéditeur est configuré", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    process.env.RESEND_FROM_EMAIL = "EduEval <no-reply@mon-domaine.sn>";

    expect(loadEmailService().warnIfUsingTestSender()).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });
});
