const fs = require("node:fs/promises");

const {
  extractEvaluationFromPdf,
} = require("../services/pdfExtraction.service");

async function extract(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Aucun fichier PDF envoyé.",
      });
    }

    const { pageCount, evaluation } = await extractEvaluationFromPdf(
      req.file.path
    );

    return res.json({
      message: "Questions extraites avec succès.",
      fichier: req.file.originalname,
      nombrePages: pageCount,
      evaluation,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        message: error.message,
        ...(error.rawResponse ? { rawResponse: error.rawResponse } : {}),
      });
    }

    return next(error);
  } finally {
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }
  }
}

module.exports = {
  extract,
};
