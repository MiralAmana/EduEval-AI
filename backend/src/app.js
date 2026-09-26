const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const { errorHandler } = require("./middleware/error.middleware");
const { TRUSTED_PROXIES } = require("./lib/trustProxy");

const authRoutes = require("./routes/auth.routes");
const aiRoutes = require("./routes/ai.routes");
const pdfRoutes = require("./routes/pdf.routes");
const evaluationRoutes = require(
  "./routes/evaluation.routes"
);
const publicationRoutes = require(
  "./routes/publication.routes"
);
const attemptRoutes = require("./routes/attempt.routes");

const app = express();

app.set("trust proxy", TRUSTED_PROXIES);

const allowedOrigins = (
  process.env.CORS_ORIGIN || "http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());

app.use(
  cors({
    origin: allowedOrigins,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("Serveur EduEval AI démarré");
});

// TEMPORAIRE — à supprimer après vérification (voir AUDIT.md, « trust proxy »).
// Renvoie à l'appelant ce que l'application voit de SA propre requête, pour
// déterminer combien de proxys (Cloudflare, load balancer Render) séparent
// l'application du client : tous les limiteurs par IP en dépendent.
app.get("/api/_diagnostics/client-ip", (req, res) => {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "");
  // Adresses de la plus proche (la socket) à la plus lointaine, comme
  // Express les parcourt pour appliquer `trust proxy`.
  const addresses = [
    req.socket.remoteAddress,
    ...forwardedFor
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .reverse(),
  ];

  res.json({
    trustProxySetting: app.get("trust proxy"),
    reqIp: req.ip,
    socketRemoteAddress: req.socket.remoteAddress,
    xForwardedFor: forwardedFor || null,
    cfConnectingIp: req.headers["cf-connecting-ip"] || null,
    trueClientIp: req.headers["true-client-ip"] || null,
    xRealIp: req.headers["x-real-ip"] || null,
    ipIfTrustProxyIs: Object.fromEntries(
      [0, 1, 2, 3, 4].map((hops) => [
        hops,
        addresses[Math.min(hops, addresses.length - 1)],
      ])
    ),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/pdf", pdfRoutes);
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

app.use(errorHandler);

module.exports = app;