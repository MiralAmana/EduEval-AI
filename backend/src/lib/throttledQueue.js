const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * File d'exécution séquentielle avec un délai minimum entre deux tâches.
 * Sert à écrêter les appels à une API externe limitée en débit : au lieu de
 * lancer 250 requêtes d'un coup quand toute une classe soumet en même temps,
 * elles partent une par une, à un rythme que l'API accepte.
 *
 * - `priority: true` place la tâche en tête de file (ex. un email de
 *   réinitialisation de mot de passe ne doit pas attendre derrière 200
 *   emails de résultats).
 * - La file est bornée : au-delà de `maxSize`, `enqueue` rejette tout de
 *   suite plutôt que de laisser la mémoire grossir sans limite.
 * - Vit en mémoire : perdue au redémarrage du processus.
 */
function createThrottledQueue({ getMinIntervalMs = () => 0, maxSize = 1000 } = {}) {
  const pending = [];
  let running = false;

  async function run() {
    if (running) {
      return;
    }

    running = true;

    while (pending.length > 0) {
      const job = pending.shift();
      const startedAt = Date.now();
      let skipWait = false;

      try {
        job.resolve(await job.task());
      } catch (error) {
        job.reject(error);
        // Une tâche qui a échoué SANS appeler l'API (ex. envoi suspendu,
        // quota atteint) n'a rien consommé du débit autorisé.
        skipWait = error?.skipThrottle === true;
      }

      // L'intervalle se compte de début de tâche à début de tâche : une tâche
      // qui a déjà duré plus longtemps que l'intervalle n'ajoute aucune attente.
      const remaining = getMinIntervalMs() - (Date.now() - startedAt);

      if (!skipWait && remaining > 0 && pending.length > 0) {
        await sleep(remaining);
      }
    }

    running = false;
  }

  function enqueue(task, { priority = false } = {}) {
    if (pending.length >= maxSize) {
      return Promise.reject(new Error("File d'envoi pleine : tâche refusée."));
    }

    return new Promise((resolve, reject) => {
      const job = { task, resolve, reject };

      if (priority) {
        pending.unshift(job);
      } else {
        pending.push(job);
      }

      run();
    });
  }

  return {
    enqueue,

    get size() {
      return pending.length;
    },
  };
}

module.exports = { createThrottledQueue, sleep };
