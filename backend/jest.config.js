module.exports = {
  // Les tests d'intégration ont leur propre config (base Postgres
  // réelle, exécution séquentielle) — voir jest.integration.config.js
  // et `npm run test:integration`.
  testPathIgnorePatterns: ["/node_modules/", "/tests/integration/"],
};
