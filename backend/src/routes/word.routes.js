const express = require("express");
const multer = require("multer");
const mammoth = require("mammoth");
const fs = require("node:fs/promises");

const corriger = require("../services/correction.service");

const router = express.Router();

const wordUpload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const exerciceTest = {
  nom: "Lettre professionnelle",
  noteMax: 20,
  criteres: [
    {
      type: "nombre_mots_min",
      valeur: 100,
      points: 5,
    },
    {
      type: "mot_obligatoire",
      valeur: "Objet",
      points: 5,
    },
    {
      type: "mot_obligatoire",
      valeur: "Cordialement",
      points: 5,
    },
    {
      type: "nombre_paragraphes_min",
      valeur: 2,
      points: 5,
    },
  ],
};

router.post(
  "/upload",
  wordUpload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: "Aucun fichier Word envoyé.",
        });
      }

      const result = await mammoth.extractRawText({
        path: req.file.path,
      });

      const texte = result.value?.trim();

      if (!texte) {
        return res.status(400).json({
          message: "Le document Word est vide.",
        });
      }

      const correction = corriger(texte, exerciceTest);

      return res.json({
        message: "Fichier Word lu et corrigé.",
        texte,
        correction,
      });
    } catch (error) {
      return next(error);
    } finally {
      if (req.file?.path) {
        await fs.unlink(req.file.path).catch(() => {});
      }
    }
  }
);

module.exports = router;