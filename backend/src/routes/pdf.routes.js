const express = require("express");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const path = require("node:path");

const controller = require("../controllers/pdf.controller");

const router = express.Router();

// Chaque extraction déclenche un appel Groq : on borne l'usage par IP
// pour protéger le coût et le disque (uploads/) contre un abus.
const extractLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Trop d'extractions demandées. Réessaie plus tard.",
  },
});

const pdfUpload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    const isPdf = file.mimetype === "application/pdf" && extension === ".pdf";

    if (!isPdf) {
      return callback(
        Object.assign(
          new Error("Seuls les véritables fichiers PDF sont acceptés."),
          { status: 400 }
        )
      );
    }

    return callback(null, true);
  },
});

router.post(
  "/extract",
  extractLimiter,
  pdfUpload.single("file"),
  controller.extract
);

module.exports = router;
