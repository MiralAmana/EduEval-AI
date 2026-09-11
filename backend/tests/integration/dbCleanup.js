const prisma = require("../../src/lib/prisma");

/**
 * Vide les tables utilisées par les tests d'intégration. Sûr
 * uniquement parce que setupEnv.js refuse de démarrer si la base
 * cible n'est pas "edueval_test" — cette base ne contient jamais que
 * des données de test jetables.
 *
 * evaluation/student cascadent déjà vers publication/question/choice/
 * criterion/attempt/answer (voir prisma/schema.prisma), donc les
 * supprimer suffit à tout nettoyer.
 */
async function cleanDatabase() {
  await prisma.evaluation.deleteMany({});
  await prisma.student.deleteMany({});
  await prisma.user.deleteMany({});
}

module.exports = { cleanDatabase };
