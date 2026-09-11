module.exports = {
  testMatch: ["**/tests/integration/**/*.integration.test.js"],
  setupFiles: ["<rootDir>/tests/integration/setupEnv.js"],
  testTimeout: 20000,
  // Toutes les suites partagent une même base Postgres : les exécuter
  // en série évite les interférences entre suites parallèles.
  maxWorkers: 1,
};
