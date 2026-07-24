require("dotenv").config();

const app = require("./src/app");

const PORT = process.env.PORT || 3000;
const KEEP_ALIVE_INTERVAL_MS = 10 * 60 * 1000;

app.listen(PORT, () => {
  console.log(`Serveur EduEval AI lancé sur http://localhost:${PORT}`);
});

// Render endort les instances gratuites après 15 min sans requête entrante.
// S'auto-appeler périodiquement via l'URL publique évite cette mise en veille.
if (process.env.RENDER_EXTERNAL_URL) {
  setInterval(() => {
    fetch(process.env.RENDER_EXTERNAL_URL).catch(() => {});
  }, KEEP_ALIVE_INTERVAL_MS);
}