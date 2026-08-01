const { askAI } = require("./ai.service");

const ALLOWED_QUESTION_TYPES = ["QCM", "SHORT_TEXT", "LONG_TEXT"];

function buildPrompt({
  subject,
  level,
  count,
  questionType,
  duration,
  objectives,
  contentType,
  targetTotalPoints,
}) {
  return `
Crée un ${
    contentType === "EXERCISE" ? "exercice" : "sujet d'évaluation"
  } complet.

Sujet : ${subject}
Niveau : ${level || "Débutant"}
Nombre exact de questions : ${count}
Type souhaité : ${questionType || "MIXED"}
Durée : ${Number(duration) || 60} minutes
Objectifs pédagogiques : ${
    objectives || "Non précisés"
  }${
    targetTotalPoints !== null
      ? `\nBarème total : l'évaluation doit être notée sur exactement ${targetTotalPoints} points au total.`
      : ""
  }

Retourne exactement cette structure JSON :

{
  "title": "Titre",
  "description": "Description",
  "instructions": "Instructions pour les participants",
  "duration": 60,
  "questions": [
    {
      "statement": "Énoncé",
      "type": "QCM",
      "choices": [
        "Choix 1",
        "Choix 2",
        "Choix 3",
        "Choix 4"
      ],
      "correctAnswer": "Bonne réponse",
      "points": 1
    }
  ]
}

Types autorisés :

- QCM
- SHORT_TEXT
- LONG_TEXT

Règles :

- Génère exactement ${count} questions.
- Respecte le niveau demandé.
- Les questions doivent couvrir le sujet et les objectifs.
- Pour un QCM, produis quatre choix plausibles.
- Une seule réponse doit être correcte dans chaque QCM.
- Pour une question non-QCM, utilise choices: [].
- Fournis toujours une bonne réponse ou un corrigé.
- Attribue un nombre de points cohérent${
    targetTotalPoints !== null
      ? ` : la somme des points de toutes les questions doit être exactement égale à ${targetTotalPoints}.`
      : "."
  }
- Ne retourne aucun texte en dehors du JSON.
`;
}

function normalizeQuestions(rawQuestions) {
  return rawQuestions.map((question) => {
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
  });
}

/**
 * L'IA respecte rarement le barème demandé au point près, donc on
 * rééquilibre les points proportionnellement pour garantir une somme
 * exacte au barème cible.
 */
function rebalancePoints(questions, targetTotalPoints) {
  const currentTotal = questions.reduce(
    (sum, question) => sum + question.points,
    0
  );

  if (Math.abs(currentTotal - targetTotalPoints) <= 0.01) {
    return questions;
  }

  const scale = targetTotalPoints / currentTotal;

  const rescaled = questions.map((question) => ({
    ...question,
    points: Math.round(question.points * scale * 10) / 10,
  }));

  const rescaledTotal = rescaled.reduce(
    (sum, question) => sum + question.points,
    0
  );

  const roundingDrift = Math.round((targetTotalPoints - rescaledTotal) * 10) / 10;

  if (roundingDrift !== 0) {
    const lastQuestion = rescaled[rescaled.length - 1];

    lastQuestion.points = Math.max(
      0,
      Math.round((lastQuestion.points + roundingDrift) * 10) / 10
    );
  }

  return rescaled;
}

async function generateEvaluation({
  subject,
  level,
  questionCount,
  questionType,
  objectives,
  duration,
  contentType,
  totalPoints,
}) {
  const count = Number(questionCount);
  const targetTotalPoints =
    totalPoints !== undefined && totalPoints !== null && totalPoints !== ""
      ? Number(totalPoints)
      : null;

  const prompt = buildPrompt({
    subject,
    level,
    count,
    questionType,
    duration,
    objectives,
    contentType,
    targetTotalPoints,
  });

  const aiResponse = await askAI(prompt, {
    json: true,
    temperature: 0.3,
    maxTokens: 6000,
    systemPrompt:
      "Tu es un enseignant expert chargé de créer des évaluations pédagogiques structurées.",
  });

  let generatedEvaluation;

  try {
    generatedEvaluation = JSON.parse(aiResponse);
  } catch {
    const error = new Error(
      "Groq a répondu, mais le JSON retourné est invalide."
    );
    error.status = 422;
    error.rawResponse = aiResponse;
    throw error;
  }

  if (
    !Array.isArray(generatedEvaluation.questions) ||
    generatedEvaluation.questions.length === 0
  ) {
    const error = new Error("Groq n’a pas généré de questions valides.");
    error.status = 422;
    throw error;
  }

  let questions = normalizeQuestions(generatedEvaluation.questions);

  if (targetTotalPoints !== null) {
    questions = rebalancePoints(questions, targetTotalPoints);
  }

  return {
    title:
      String(generatedEvaluation.title || "").trim() ||
      `Évaluation — ${subject}`,
    description: String(generatedEvaluation.description || "").trim(),
    instructions: String(generatedEvaluation.instructions || "").trim(),
    duration:
      Number(generatedEvaluation.duration) > 0
        ? Number(generatedEvaluation.duration)
        : Number(duration) || 60,
    questions,
  };
}

module.exports = {
  generateEvaluation,
  // Exportées pour les tests unitaires.
  normalizeQuestions,
  rebalancePoints,
};
