const { askAI } = require("./ai.service");

async function gradeAnswerWithAI(question, textAnswer) {
  const prompt = `
Corrige la réponse d’un étudiant à une question d’évaluation.

Question : ${question.statement}
Réponse attendue (si fournie, sinon juge la pertinence toi-même) : ${
    question.correctAnswer?.trim() || "Non fournie"
  }
Nombre de points maximum pour cette question : ${question.points}
Réponse donnée par l’étudiant : ${
    textAnswer?.trim() || "(Aucune réponse donnée)"
  }

Retourne exactement ce JSON :

{
  "score": 0,
  "feedback": "Courte justification en français, deux phrases maximum."
}

Règles :

- Le score doit être un nombre entre 0 et ${question.points}, décimales autorisées.
- Sois rigoureux mais bienveillant.
- Ne retourne aucun texte en dehors du JSON.
`;

  const response = await askAI(prompt, {
    json: true,
    temperature: 0,
    maxTokens: 400,
    systemPrompt:
      "Tu es un enseignant qui corrige des copies avec rigueur et bienveillance.",
  });

  let parsed;

  try {
    parsed = JSON.parse(response);
  } catch {
    const error = new Error(
      "L’IA a renvoyé une réponse invalide, réessaie."
    );
    error.status = 422;
    throw error;
  }

  const rawScore = Number(parsed.score);
  const score = Number.isFinite(rawScore)
    ? Math.min(Math.max(rawScore, 0), question.points)
    : 0;

  return {
    score,
    feedback: String(parsed.feedback || "").trim(),
  };
}

module.exports = {
  gradeAnswerWithAI,
};
