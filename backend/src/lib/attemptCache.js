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

// Met à jour EN PLACE l'entrée en cache, sans repousser son expiration :
// une sauvegarde de réponse n'a plus à vider le cache (ce qui coûtait un
// rechargement complet — 9 requêtes SQL — à la sauvegarde suivante), mais
// le TTL continue de courir, donc un changement fait côté enseignant
// (évaluation désactivée, etc.) est vu au plus tard à l'expiration.
// `updater` s'applique à la valeur COURANTE (pas à une copie lue plus tôt) :
// deux sauvegardes qui se chevauchent s'additionnent au lieu de s'écraser.
// Ne fait rien (renvoie undefined) si l'entrée est absente ou expirée.
function update(attemptId, updater) {
  const entry = store.get(attemptId);

  if (!entry) {
    return undefined;
  }

  if (Date.now() > entry.expiresAt) {
    store.delete(attemptId);
    return undefined;
  }

  entry.value = updater(entry.value);

  return entry.value;
}

function invalidate(attemptId) {
  store.delete(attemptId);
}

function clear() {
  store.clear();
}

// Sans balayage, une entrée n'est supprimée que si on la relit après son
// expiration : les tentatives terminées s'accumuleraient en mémoire jusqu'au
// prochain redémarrage.
const SWEEP_INTERVAL_MS = 60 * 1000;

function sweep() {
  const now = Date.now();

  for (const [attemptId, entry] of store) {
    if (now > entry.expiresAt) {
      store.delete(attemptId);
    }
  }
}

setInterval(sweep, SWEEP_INTERVAL_MS).unref();

module.exports = {
  get,
  set,
  update,
  invalidate,
  clear,
  sweep,
};
