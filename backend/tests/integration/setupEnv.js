const path = require("node:path");

require("dotenv").config({
  path: path.join(__dirname, "..", "..", ".env.test"),
});

if (!/edueval_test/.test(process.env.DATABASE_URL || "")) {
  throw new Error(
    "DATABASE_URL (via backend/.env.test) ne pointe pas vers une base " +
      "de test (\"edueval_test\" attendu dans le nom). Les tests " +
      "d'intégration suppriment leurs données à chaque exécution : " +
      "on refuse de continuer par sécurité plutôt que de risquer une " +
      "base de dev/prod."
  );
}
