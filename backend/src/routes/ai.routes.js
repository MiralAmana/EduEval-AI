const express = require("express");

const { askAI } = require("../services/ai.service");

const router = express.Router();

router.get("/test", async (req, res) => {
  try {
    const response = await askAI(
      "Réponds uniquement par : Bonjour Charlize."
    );

    return res.json({
      response,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Impossible de communiquer avec Groq.",
      error: error.response?.data || error.message,
    });
  }
});

router.post("/generate-evaluation", async (req, res, next) => {
  try {
    const {
      subject,
      level,
      questionCount,
      questionType,
      objectives,
      duration,
      contentType,
      totalPoints,
    } = req.body || {};

    if (!subject || !String(subject).trim()) {
      return res.status(400).json({
        message: "Le sujet est obligatoire.",
      });
    }

    const count = Number(questionCount);

    if (!count || count < 1 || count > 100) {
      return res.status(400).json({
        message:
          "Le nombre de questions doit être compris entre 1 et 100.",
      });
    }

    const targetTotalPoints =
      totalPoints !== undefined && totalPoints !== null && totalPoints !== ""
        ? Number(totalPoints)
        : null;

    if (targetTotalPoints !== null && targetTotalPoints <= 0) {
      return res.status(400).json({
        message: "Le barème total doit être supérieur à zéro.",
      });
    }

    const prompt = `
Crée un ${
      contentType === "EXERCISE"
        ? "exercice"
        : "sujet d'évaluation"
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
      return res.status(422).json({
        message:
          "Groq a répondu, mais le JSON retourné est invalide.",
        rawResponse: aiResponse,
      });
    }

    if (
      !Array.isArray(generatedEvaluation.questions) ||
      generatedEvaluation.questions.length === 0
    ) {
      return res.status(422).json({
        message:
          "Groq n’a pas généré de questions valides.",
      });
    }

    const questions = generatedEvaluation.questions.map(
      (question) => {
        const type = [
          "QCM",
          "SHORT_TEXT",
          "LONG_TEXT",
        ].includes(question.type)
          ? question.type
          : "SHORT_TEXT";

        return {
          statement: String(question.statement || "").trim(),
          type,
          choices:
            type === "QCM" && Array.isArray(question.choices)
              ? question.choices
                  .map((choice) => String(choice).trim())
                  .filter(Boolean)
              : [],
          correctAnswer: String(
            question.correctAnswer || ""
          ).trim(),
          points:
            Number(question.points) > 0
              ? Number(question.points)
              : 1,
        };
      }
    );

    // Filet de sécurité : l'IA respecte rarement le barème demandé au
    // point près, donc on rééquilibre les points proportionnellement
    // pour garantir une somme exacte.
    if (targetTotalPoints !== null) {
      const currentTotal = questions.reduce(
        (sum, question) => sum + question.points,
        0
      );

      if (Math.abs(currentTotal - targetTotalPoints) > 0.01) {
        const scale = targetTotalPoints / currentTotal;

        questions.forEach((question) => {
          question.points =
            Math.round(question.points * scale * 10) / 10;
        });

        const rescaledTotal = questions.reduce(
          (sum, question) => sum + question.points,
          0
        );

        const roundingDrift =
          Math.round((targetTotalPoints - rescaledTotal) * 10) / 10;

        if (roundingDrift !== 0) {
          const lastQuestion = questions[questions.length - 1];

          lastQuestion.points = Math.max(
            0,
            Math.round(
              (lastQuestion.points + roundingDrift) * 10
            ) / 10
          );
        }
      }
    }

    return res.json({
      message: "Évaluation générée avec succès.",
      evaluation: {
        title:
          String(generatedEvaluation.title || "").trim() ||
          `Évaluation — ${subject}`,
        description: String(
          generatedEvaluation.description || ""
        ).trim(),
        instructions: String(
          generatedEvaluation.instructions || ""
        ).trim(),
        duration:
          Number(generatedEvaluation.duration) > 0
            ? Number(generatedEvaluation.duration)
            : Number(duration) || 60,
        questions,
      },
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;