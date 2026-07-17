const axios = require("axios");

const client = axios.create({
  baseURL: "https://api.groq.com/openai/v1",
  timeout: 120000,
  headers: {
    "Content-Type": "application/json",
  },
});

async function askAI(prompt, options = {}) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error(
      "La variable GROQ_API_KEY est absente du fichier backend/.env."
    );
  }

  const requestBody = {
    model: "llama-3.3-70b-versatile",
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

  const response = await client.post(
    "/chat/completions",
    requestBody,
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
}

module.exports = {
  askAI,
};