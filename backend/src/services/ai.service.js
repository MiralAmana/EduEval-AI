const axios = require("axios");

const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const MAX_RETRIES = 2;
const DEFAULT_RETRY_BASE_DELAY_MS = 500;

const client = axios.create({
  baseURL: "https://api.groq.com/openai/v1",
  timeout: 120000,
  headers: {
    "Content-Type": "application/json",
  },
});

function getModel() {
  return process.env.GROQ_MODEL || DEFAULT_MODEL;
}

// Optionnel : si Groq retire/dégrade le modèle principal, on peut
// basculer sur un second modèle sans changement de code. Vide par
// défaut (pas de repli tenté) plutôt que de deviner un modèle de
// secours qui pourrait ne plus exister.
function getFallbackModel() {
  return process.env.GROQ_FALLBACK_MODEL || null;
}

function getRetryBaseDelayMs() {
  const configured = Number(process.env.GROQ_RETRY_BASE_DELAY_MS);

  return Number.isFinite(configured) && configured >= 0
    ? configured
    : DEFAULT_RETRY_BASE_DELAY_MS;
}

function isRetryableError(error) {
  if (!error.response) {
    // Erreur réseau/timeout : transitoire.
    return true;
  }

  const { status } = error.response;

  return status === 429 || status >= 500;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildRequestBody(prompt, options, model) {
  const requestBody = {
    model,
    messages: [
      {
        role: "system",
        content:
          options.systemPrompt ||
          "Tu es un assistant pédagogique. Respecte strictement les consignes.",
      },
      {
        role: "user",
        content:
          options.json === true
            ? `Réponds uniquement avec un objet JSON valide.\n\n${prompt}`
            : prompt,
      },
    ],
    temperature: options.temperature ?? 0.1,
    max_completion_tokens: options.maxTokens ?? 3000,
  };

  if (options.json === true) {
    requestBody.response_format = {
      type: "json_object",
    };
  }

  return requestBody;
}

/**
 * Appelle Groq avec un modèle donné, en reprenant automatiquement en
 * cas d'erreur transitoire (timeout, réseau, 429, 5xx) avec un
 * backoff exponentiel. Les erreurs non transitoires (ex. 400, clé
 * API invalide) échouent immédiatement, sans retry inutile.
 */
async function callModel(prompt, options, model) {
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await client.post(
        "/chat/completions",
        buildRequestBody(prompt, options, model),
        {
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          },
        }
      );

      const content = response.data?.choices?.[0]?.message?.content;

      if (typeof content !== "string" || !content.trim()) {
        throw new Error("Groq a renvoyé une réponse vide.");
      }

      return content.trim();
    } catch (error) {
      lastError = error;

      if (attempt === MAX_RETRIES || !isRetryableError(error)) {
        throw error;
      }

      await wait(getRetryBaseDelayMs() * 2 ** attempt);
    }
  }

  throw lastError;
}

async function askAI(prompt, options = {}) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error(
      "La variable GROQ_API_KEY est absente du fichier backend/.env."
    );
  }

  const model = getModel();

  try {
    return await callModel(prompt, options, model);
  } catch (error) {
    const fallbackModel = getFallbackModel();

    if (
      !fallbackModel ||
      fallbackModel === model ||
      !isRetryableError(error)
    ) {
      throw error;
    }

    return callModel(prompt, options, fallbackModel);
  }
}

module.exports = {
  askAI,
};
