const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/auth.routes");
const aiRoutes = require("./routes/ai.routes");
const pdfRoutes = require("./routes/pdf.routes");
const wordRoutes = require("./routes/word.routes");
const evaluationRoutes = require(
  "./routes/evaluation.routes"
);
const publicationRoutes = require(
  "./routes/publication.routes"
);
const attemptRoutes = require("./routes/attempt.routes");

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("Serveur EduEval AI démarré");
});

app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/pdf", pdfRoutes);
app.use("/api/word", wordRoutes);
app.use("/api/evaluations", evaluationRoutes);
app.use("/api/publications", publicationRoutes);
app.use("/api/attempts", attemptRoutes);

/**
 * Affiche clairement les routes inexistantes.
 */
app.use((req, res) => {
  return res.status(404).json({
    message: `Route introuvable : ${req.method} ${req.originalUrl}`,
  });
});

app.use((error, req, res, next) => {
  console.error(error);

  return res.status(error.status || 500).json({
    message:
      error.message ||
      "Une erreur interne est survenue.",
  });
});

module.exports = app;