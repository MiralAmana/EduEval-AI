const { askAI } = require("./ai.service");

/**
 * Résume les questions déjà corrigées sur la même copie, pour que
 * l'IA applique un niveau d'exigence cohérent d'une question à
 * l'autre plutôt que de noter chaque réponse dans l'isolement total.
 */
function formatPriorGrading(priorGrading) {
  if (!priorGrading || priorGrading.length === 0) {
    return "(Aucune autre question déjà corrigée sur cette copie.)";
  }

  return priorGrading
    .map(
      (item, index) =>
        `${index + 1}. Question : ${item.statement}\n   Réponse de l’étudiant : ${
          item.textAnswer?.trim() || "(Aucune réponse donnée)"
        }\n   Note donnée : ${item.score} / ${item.points}`
    )
    .join("\n");
}

async function gradeAnswerWithAI(question, textAnswer, priorGrading = []) {
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

Corrections déjà effectuées sur cette même copie (reste cohérent avec
le niveau d’exigence déjà appliqué) :
${formatPriorGrading(priorGrading)}

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
