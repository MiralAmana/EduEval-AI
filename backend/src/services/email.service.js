const crypto = require("node:crypto");

const { Resend } = require("resend");

const { createThrottledQueue, sleep } = require("../lib/throttledQueue");

const DEFAULT_FROM = "EduEval AI <onboarding@resend.dev>";
const MAX_RETRIES = 3;
const MAX_RETRY_DELAY_MS = 10 * 1000;
const QUOTA_PAUSE_MS = 60 * 60 * 1000;
const QUOTA_ERROR_NAMES = new Set([
  "daily_quota_exceeded",
  "monthly_quota_exceeded",
]);

function getClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error(
      "La variable RESEND_API_KEY est absente du fichier backend/.env."
    );
  }

  return new Resend(process.env.RESEND_API_KEY);
}

function getFromAddress() {
  return process.env.RESEND_FROM_EMAIL || DEFAULT_FROM;
}

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);

  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

// Le prénom (saisi librement par l'étudiant) et le titre de l'évaluation
// sont insérés dans du HTML : sans échappement, ils permettraient
// d'injecter du contenu trompeur (phishing) dans l'email envoyé.
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

class EmailSendError extends Error {
  constructor(message, { statusCode, name, skipThrottle } = {}) {
    super(message);

    this.name = "EmailSendError";
    this.statusCode = statusCode ?? null;
    this.resendName = name ?? null;
    // Échec sans appel à l'API : la file n'a pas à temporiser avant la suite.
    this.skipThrottle = skipThrottle === true;
  }
}

function quotaBlockedError() {
  return new EmailSendError("Quota d'envoi Resend atteint : envoi suspendu.", {
    statusCode: 429,
    name: "quota_blocked",
    skipThrottle: true,
  });
}

// Les emails partent un par un, à un rythme que l'API Resend accepte (10
// requêtes/s par équipe) : 250 élèves qui soumettent ensemble ne déclenchent
// plus 250 appels simultanés.
const queue = createThrottledQueue({
  getMinIntervalMs: () => numberFromEnv("EMAIL_MIN_INTERVAL_MS", 200),
  maxSize: 2000,
});

// Une fois le quota (journalier ou mensuel) atteint, inutile de continuer à
// appeler l'API : chaque envoi échouerait de la même façon.
let quotaBlockedUntil = 0;

function isRetryable(error) {
  if (QUOTA_ERROR_NAMES.has(error.name)) {
    return false;
  }

  // Limite de débit, panne de Resend, ou pas de réponse (réseau).
  return (
    error.statusCode === 429 ||
    error.statusCode === null ||
    error.statusCode === undefined ||
    error.statusCode >= 500
  );
}

function retryDelayMs(attempt, headers) {
  const retryAfterSeconds = Number(headers?.["retry-after"]);
  const backoff = numberFromEnv("EMAIL_RETRY_BASE_MS", 1000) * 2 ** attempt;
  const delay = Number.isFinite(retryAfterSeconds)
    ? Math.max(backoff, retryAfterSeconds * 1000)
    : backoff;

  return Math.min(delay, MAX_RETRY_DELAY_MS);
}

/**
 * Le SDK Resend NE LÈVE PAS d'exception sur une erreur HTTP (limite de
 * débit, quota, expéditeur refusé…) : il renvoie `{ data: null, error }`.
 * Sans ce contrôle, un envoi refusé passait pour réussi, sans aucune trace.
 */
async function deliver(payload) {
  const idempotencyKey = crypto.randomUUID();

  for (let attempt = 0; ; attempt += 1) {
    if (Date.now() < quotaBlockedUntil) {
      throw quotaBlockedError();
    }

    // Même clé pour tous les essais d'un même email : un réessai après une
    // coupure réseau ne peut pas produire de doublon.
    const { data, error, headers } = await getClient().emails.send(payload, {
      idempotencyKey,
    });

    if (!error) {
      return data;
    }

    if (QUOTA_ERROR_NAMES.has(error.name)) {
      quotaBlockedUntil = Date.now() + QUOTA_PAUSE_MS;
    }

    if (attempt >= MAX_RETRIES || !isRetryable(error)) {
      throw new EmailSendError(
        `Resend ${error.statusCode ?? "?"} ${error.name} : ${error.message}`,
        error
      );
    }

    await sleep(retryDelayMs(attempt, headers));
  }
}

function send(payload, options) {
  // Quota déjà atteint : inutile de mettre l'email en file.
  if (Date.now() < quotaBlockedUntil) {
    return Promise.reject(quotaBlockedError());
  }

  return queue.enqueue(() => deliver(payload), options);
}

async function sendResultsPublishedEmail({
  to,
  firstName,
  evaluationTitle,
  score,
  maxScore,
}) {
  return send({
    from: getFromAddress(),
    to,
    subject: `Votre note pour « ${evaluationTitle} » est disponible`,
    html: `
      <p>Bonjour ${escapeHtml(firstName)},</p>
      <p>Votre évaluation « ${escapeHtml(evaluationTitle)} » a été corrigée par votre enseignant.</p>
      <p style="font-size: 18px;"><strong>Note obtenue : ${score} / ${maxScore}</strong></p>
      <p>— EduEval AI</p>
    `,
  });
}

async function sendPasswordResetEmail({ to, firstName, resetLink }) {
  // Prioritaire : ne doit pas attendre derrière les emails de résultats.
  return send(
    {
      from: getFromAddress(),
      to,
      subject: "Réinitialisation de votre mot de passe EduEval AI",
      html: `
      <p>Bonjour ${escapeHtml(firstName)},</p>
      <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
      <p><a href="${escapeHtml(resetLink)}">Cliquez ici pour choisir un nouveau mot de passe</a></p>
      <p>Ce lien expire dans 1 heure. Si vous n’êtes pas à l’origine de cette demande, ignorez cet email.</p>
      <p>— EduEval AI</p>
    `,
    },
    { priority: true }
  );
}

/**
 * À appeler au démarrage. Le domaine de test resend.dev n'envoie qu'à
 * l'adresse du compte Resend (erreur 403 pour tout autre destinataire) :
 * sans domaine vérifié, aucun élève ni aucun autre enseignant ne reçoit
 * d'email.
 */
function warnIfUsingTestSender() {
  if (process.env.RESEND_FROM_EMAIL) {
    return false;
  }

  console.warn(
    "[email] RESEND_FROM_EMAIL n'est pas défini : l'expéditeur de test " +
      "resend.dev n'envoie qu'à l'adresse du compte Resend. Vérifie un " +
      "domaine sur Resend puis renseigne RESEND_FROM_EMAIL pour que les " +
      "élèves et les autres enseignants reçoivent leurs emails."
  );

  return true;
}

module.exports = {
  EmailSendError,
  sendResultsPublishedEmail,
  sendPasswordResetEmail,
  warnIfUsingTestSender,
};
