const express = require("express");
const multer = require("multer");
const path = require("node:path");

const controller = require("../controllers/pdf.controller");

const router = express.Router();

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
        new Error("Seuls les véritables fichiers PDF sont acceptés.")
      );
    }

    return callback(null, true);
  },
});

router.post("/extract", pdfUpload.single("file"), controller.extract);

module.exports = router;
