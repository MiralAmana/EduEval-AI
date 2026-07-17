const express = require("express");
const multer = require("multer");
const fs = require("node:fs/promises");
const path = require("node:path");
const { PDFParse } = require("pdf-parse");

const { askAI } = require("../services/ai.service");

const router = express.Router();

const pdfUpload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    const isPdf =
      file.mimetype === "application/pdf" &&
      extension === ".pdf";

    if (!isPdf) {
      return callback(
        new Error("Seuls les véritables fichiers PDF sont acceptés.")
      );
    }

    return callback(null, true);
  },
});

router.post(
  "/extract",
  pdfUpload.single("file"),
  async (req, res, next) => {
    let parser;

    try {
      if (!req.file) {
        return res.status(400).json({
          message: "Aucun fichier PDF envoyé.",
        });
      }

      const buffer = await fs.readFile(req.file.path);

      parser = new PDFParse({
        data: buffer,
      });

      const pdfResult = await parser.getText();
      const texte = pdfResult.text?.trim();

      if (!texte) {
        return res.status(400).json({
          message:
            "Aucun texte n’a été détecté. Le PDF est peut-être vide ou scanné.",
        });
      }

      const prompt = `
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

      const aiResponse = await askAI(prompt, {
        json: true,
        temperature: 0,
        maxTokens: 4000,
        systemPrompt:
          "Tu es un extracteur fidèle de sujets d’évaluation. Tu ne dois jamais créer ou inventer de question.",
      });

      let evaluation;

      try {
        evaluation = JSON.parse(aiResponse);
      } catch {
        return res.status(422).json({
          message:
            "Groq a répondu, mais le JSON retourné est invalide.",
          rawResponse: aiResponse,
        });
      }

      if (
        evaluation.containsQuestions !== true ||
        !Array.isArray(evaluation.questions) ||
        evaluation.questions.length === 0
      ) {
        return res.status(422).json({
          message:
            "Ce PDF ne contient aucune question identifiable. Utilise la section « Générer avec l’IA » pour créer des questions à partir d’un cours.",
        });
      }

      const questions = evaluation.questions
        .map((question) => {
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
        })
        .filter((question) => question.statement);

      if (questions.length === 0) {
        return res.status(422).json({
          message:
            "Aucune question exploitable n’a été trouvée dans ce PDF.",
        });
      }

      return res.json({
        message: "Questions extraites avec succès.",
        fichier: req.file.originalname,
        nombrePages: pdfResult.total,
        evaluation: {
          title:
            String(evaluation.title || "").trim() ||
            "Évaluation importée",
          description: String(
            evaluation.description || ""
          ).trim(),
          duration:
            Number(evaluation.duration) > 0
              ? Number(evaluation.duration)
              : 60,
          questions,
        },
      });
    } catch (error) {
      return next(error);
    } finally {
      if (parser) {
        await parser.destroy().catch(() => {});
      }

      if (req.file?.path) {
        await fs.unlink(req.file.path).catch(() => {});
      }
    }
  }
);

module.exports = router;