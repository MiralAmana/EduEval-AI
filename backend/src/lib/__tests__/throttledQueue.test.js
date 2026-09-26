const { createThrottledQueue } = require("../throttledQueue");

afterEach(() => {
  jest.useRealTimers();
});

describe("createThrottledQueue", () => {
  it("exécute les tâches une par une, dans l'ordre d'arrivée, et renvoie leur résultat", async () => {
    const queue = createThrottledQueue();
    const order = [];

    const results = await Promise.all(
      [1, 2, 3].map((n) =>
        queue.enqueue(async () => {
          order.push(`début ${n}`);
          await Promise.resolve();
          order.push(`fin ${n}`);

          return n * 10;
        })
      )
    );

    expect(results).toEqual([10, 20, 30]);
    expect(order).toEqual([
      "début 1",
      "fin 1",
      "début 2",
      "fin 2",
      "début 3",
      "fin 3",
    ]);
  });

  it("attend l'intervalle minimum entre deux tâches", async () => {
    jest.useFakeTimers();

    const queue = createThrottledQueue({ getMinIntervalMs: () => 500 });
    const task = jest.fn().mockResolvedValue("ok");

    const all = Promise.all([queue.enqueue(task), queue.enqueue(task)]);

    await jest.advanceTimersByTimeAsync(0);
    expect(task).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(499);
    expect(task).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    expect(task).toHaveBeenCalledTimes(2);

    await all;
  });

  it("compte l'intervalle de début à début : une tâche déjà lente n'ajoute pas d'attente", async () => {
    jest.useFakeTimers();

    const queue = createThrottledQueue({ getMinIntervalMs: () => 200 });
    const startTimes = [];
    const slowTask = async () => {
      startTimes.push(Date.now());
      await new Promise((resolve) => setTimeout(resolve, 150));
    };

    const all = Promise.all([
      queue.enqueue(slowTask),
      queue.enqueue(slowTask),
      queue.enqueue(slowTask),
    ]);

    await jest.advanceTimersByTimeAsync(1000);
    await all;

    // Débuts espacés de 200 ms (et non 150 + 200 = 350 ms).
    expect(startTimes[1] - startTimes[0]).toBe(200);
    expect(startTimes[2] - startTimes[1]).toBe(200);
  });

  it("ne temporise pas après une tâche qui a échoué sans appeler l'API (skipThrottle)", async () => {
    jest.useFakeTimers();

    const queue = createThrottledQueue({ getMinIntervalMs: () => 500 });
    const second = jest.fn().mockResolvedValue("ok");

    const first = queue.enqueue(async () => {
      throw Object.assign(new Error("suspendu"), { skipThrottle: true });
    });
    first.catch(() => {});
    const all = queue.enqueue(second);

    await jest.advanceTimersByTimeAsync(0);

    expect(second).toHaveBeenCalledTimes(1); // aucune attente de 500 ms
    await all;
  });

  it("place une tâche prioritaire en tête de la file d'attente", async () => {
    jest.useFakeTimers();

    const queue = createThrottledQueue({ getMinIntervalMs: () => 100 });
    const order = [];
    const record = (name) => async () => order.push(name);

    const all = Promise.all([
      queue.enqueue(record("a")),
      queue.enqueue(record("b")),
      queue.enqueue(record("c")),
      queue.enqueue(record("urgent"), { priority: true }),
    ]);

    await jest.advanceTimersByTimeAsync(1000);
    await all;

    expect(order).toEqual(["a", "urgent", "b", "c"]);
  });

  it("une tâche en échec rejette sa promesse sans bloquer les suivantes", async () => {
    const queue = createThrottledQueue();

    const results = await Promise.allSettled([
      queue.enqueue(async () => {
        throw new Error("boom");
      }),
      queue.enqueue(async () => "suite"),
    ]);

    expect(results[0]).toMatchObject({ status: "rejected" });
    expect(results[1]).toEqual({ status: "fulfilled", value: "suite" });
  });

  it("refuse les nouvelles tâches quand la file est pleine", async () => {
    const queue = createThrottledQueue({ maxSize: 2 });
    let release;
    const blocker = new Promise((resolve) => {
      release = resolve;
    });

    const running = queue.enqueue(() => blocker); // en cours, sort de la file
    const waiting = [
      queue.enqueue(async () => 1),
      queue.enqueue(async () => 2),
    ];

    await expect(queue.enqueue(async () => 3)).rejects.toThrow(/pleine/);

    release();
    await Promise.all([running, ...waiting]);
    expect(queue.size).toBe(0);
  });

  it("repart normalement après avoir vidé la file", async () => {
    const queue = createThrottledQueue();

    await queue.enqueue(async () => "premier");

    await expect(queue.enqueue(async () => "second")).resolves.toBe("second");
  });
});
