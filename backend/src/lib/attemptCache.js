// Cache mémoire (process local) du contexte complet d'une tentative
// (évaluation + questions + choix + réponses + student + publication).
// Le contexte change peu pendant la session d'un étudiant ; ce cache
// évite de refaire la requête Prisma imbriquée à chaque lecture
// rapprochée, tout en restant invalidé dès qu'une écriture survient.
//
// Limite connue : ce cache est local au process. En déploiement
// multi-instance (ex. Render avec plusieurs instances), une écriture
// sur une instance n'invalide pas le cache des autres — à migrer vers
// un cache partagé (Redis) si l'app grandit dans cette direction.

const TTL_MS = 10 * 1000;

const store = new Map();

function get(attemptId) {
  const entry = store.get(attemptId);

  if (!entry) {
    return undefined;
  }

  if (Date.now() > entry.expiresAt) {
    store.delete(attemptId);
    return undefined;
  }

  return entry.value;
}

function set(attemptId, value) {
  store.set(attemptId, {
    value,
    expiresAt: Date.now() + TTL_MS,
  });
}

function invalidate(attemptId) {
  store.delete(attemptId);
}

function clear() {
  store.clear();
}

module.exports = {
  get,
  set,
  invalidate,
  clear,
};
