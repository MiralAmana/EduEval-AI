const fs = require("node:fs/promises");
const { PDFParse } = require("pdf-parse");

const { askAI } = require("./ai.service");
const {
  DEFAULT_MAX_CHUNKS,
  chunkPagesByCharBudget,
} = require("../lib/pdfChunking");

const ALLOWED_QUESTION_TYPES = ["QCM", "SHORT_TEXT", "LONG_TEXT"];

function buildExtractionPrompt(texte) {
  return `
Tu dois uniquement recopier et structurer les questions déjà présentes dans le document.

INTERDICTIONS ABSOLUES :

- Ne génère aucune nouvelle question.
- N'invente aucun choix de réponse absent du document.
- Ne transforme pas un texte de cours en questionnaire.
- Ne complète pas les questions manquantes.
- Ne reformule pas inutilement les énoncés.
- Ne crée pas de corrigé lorsqu'aucune réponse n'est présente ou déductible avec certitude.

Si le document ne contient aucune question explicite, retourne exactement :

{
  "containsQuestions": false,
  "title": "",
  "description": "",
  "duration": 0,
  "questions": []
}

Si le document contient des questions, retourne :

{
  "containsQuestions": true,
  "title": "Titre présent dans le document ou titre très court",
  "description": "Description courte basée uniquement sur le document",
  "duration": 60,
  "questions": [
    {
      "statement": "Question recopiée fidèlement",
      "type": "QCM",
      "choices": [],
      "correctAnswer": "",
      "points": 1
    }
  ]
}

Types autorisés :

- QCM
- SHORT_TEXT
- LONG_TEXT

Règles :

- Utilise QCM seulement lorsque des choix sont réellement présents.
- Recopie tous les choix présents dans le document.
- Pour les autres questions, utilise choices: [].
- Si une bonne réponse est explicitement présente, recopie-la.
- Sinon, utilise correctAnswer: "".
- Si les points sont indiqués, conserve-les.
- Sinon, utilise 1.
- Ne retourne aucun texte en dehors du JSON.

Document PDF :

${texte}
`;
}

async function extractQuestionsFromChunk(texte) {
  const aiResponse = await askAI(buildExtractionPrompt(texte), {
    json: true,
    temperature: 0,
    maxTokens: 4000,
    systemPrompt:
      "Tu es un extracteur fidèle de sujets d’évaluation. Tu ne dois jamais créer ou inventer de question.",
  });

  try {
    return JSON.parse(aiResponse);
  } catch {
    const error = new Error("JSON invalide renvoyé par Groq.");
    error.rawResponse = aiResponse;
    throw error;
  }
}

function normalizeQuestions(rawQuestions) {
  return rawQuestions
    .map((question) => {
      const type = ALLOWED_QUESTION_TYPES.includes(question.type)
        ? question.type
        : "SHORT_TEXT";

      return {
        statement: String(question.statement || "").trim(),
        type,
        choices:
          type === "QCM" && Array.isArray(question.choices)
            ? question.choices.map((choice) => String(choice).trim()).filter(Boolean)
            : [],
        correctAnswer: String(question.correctAnswer || "").trim(),
        points: Number(question.points) > 0 ? Number(question.points) : 1,
      };
    })
    .filter((question) => question.statement);
}

/**
 * Lit un PDF, le découpe par pages sous un budget de caractères
 * (évite d'injecter un document entier dans un seul prompt), extrait
 * les questions déjà présentes chunk par chunk via Groq, puis fusionne
 * le résultat. Un petit document tient dans un unique chunk.
 */
async function extractEvaluationFromPdf(filePath) {
  let parser;

  try {
    const buffer = await fs.readFile(filePath);

    parser = new PDFParse({ data: buffer });

    const pdfResult = await parser.getText();
    const texte = pdfResult.text?.trim();

    if (!texte) {
      const error = new Error(
        "Aucun texte n’a été détecté. Le PDF est peut-être vide ou scanné."
      );
      error.status = 400;
      throw error;
    }

    const pageChunks = chunkPagesByCharBudget(
      pdfResult.pages?.length ? pdfResult.pages : [{ num: 1, text: texte }]
    );

    if (pageChunks.length > DEFAULT_MAX_CHUNKS) {
      const error = new Error(
        `Ce PDF est trop volumineux pour être importé en une fois (${pdfResult.total} pages). Scinde-le en documents plus courts.`
      );
      error.status = 413;
      throw error;
    }

    let title = "";
    let description = "";
    let duration = 0;
    const rawQuestions = [];
    let lastInvalidResponse = null;
    let parsedChunkCount = 0;

    for (const chunkPages of pageChunks) {
      const chunkText = chunkPages.map((page) => page.text).join("\n\n");

      let evaluation;

      try {
        evaluation = await extractQuestionsFromChunk(chunkText);
      } catch (chunkError) {
        lastInvalidResponse = chunkError.rawResponse || null;
        continue;
      }

      parsedChunkCount += 1;

      if (
        evaluation.containsQuestions === true &&
        Array.isArray(evaluation.questions)
      ) {
        rawQuestions.push(...evaluation.questions);

        if (!title && evaluation.title) {
          title = evaluation.title;
        }

        if (!description && evaluation.description) {
          description = evaluation.description;
        }

        if (!duration && Number(evaluation.duration) > 0) {
          duration = Number(evaluation.duration);
        }
      }
    }

    if (parsedChunkCount === 0) {
      const error = new Error("Groq a répondu, mais le JSON retourné est invalide.");
      error.status = 422;
      error.rawResponse = lastInvalidResponse;
      throw error;
    }

    if (rawQuestions.length === 0) {
      const error = new Error(
        "Ce PDF ne contient aucune question identifiable. Utilise la section « Générer avec l’IA » pour créer des questions à partir d’un cours."
      );
      error.status = 422;
      throw error;
    }

    const questions = normalizeQuestions(rawQuestions);

    if (questions.length === 0) {
      const error = new Error("Aucune question exploitable n’a été trouvée dans ce PDF.");
      error.status = 422;
      throw error;
    }

    return {
      pageCount: pdfResult.total,
      evaluation: {
        title: String(title || "").trim() || "Évaluation importée",
        description: String(description || "").trim(),
        duration: Number(duration) > 0 ? Number(duration) : 60,
        questions,
      },
    };
  } finally {
    if (parser) {
      await parser.destroy().catch(() => {});
    }
  }
}

module.exports = {
  extractEvaluationFromPdf,
  // Exportées pour les tests unitaires.
  normalizeQuestions,
};
