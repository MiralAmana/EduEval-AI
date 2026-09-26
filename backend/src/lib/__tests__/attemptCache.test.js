const attemptCache = require("../attemptCache");

beforeEach(() => {
  attemptCache.clear();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("attemptCache.update", () => {
  it("applique la fonction à la valeur courante et renvoie le résultat", () => {
    attemptCache.set("a", { n: 1 });

    const result = attemptCache.update("a", (value) => ({ n: value.n + 1 }));

    expect(result).toEqual({ n: 2 });
    expect(attemptCache.get("a")).toEqual({ n: 2 });
  });

  it("ne repousse pas l'expiration de l'entrée", () => {
    attemptCache.set("a", { n: 1 }); // expire à t = 10 s

    jest.advanceTimersByTime(9 * 1000);
    attemptCache.update("a", (value) => ({ n: value.n + 1 }));
    jest.advanceTimersByTime(2 * 1000); // t = 11 s

    expect(attemptCache.get("a")).toBeUndefined();
  });

  it("ne fait rien si l'entrée est absente", () => {
    const updater = jest.fn();

    expect(attemptCache.update("absente", updater)).toBeUndefined();
    expect(updater).not.toHaveBeenCalled();
    expect(attemptCache.get("absente")).toBeUndefined();
  });

  it("ne fait rien si l'entrée est expirée", () => {
    attemptCache.set("a", { n: 1 });
    jest.advanceTimersByTime(11 * 1000);
    const updater = jest.fn();

    expect(attemptCache.update("a", updater)).toBeUndefined();
    expect(updater).not.toHaveBeenCalled();
  });
});

describe("attemptCache.sweep", () => {
  it("supprime les entrées expirées sans toucher aux autres", () => {
    attemptCache.set("vieille", { n: 1 });
    jest.advanceTimersByTime(8 * 1000);
    attemptCache.set("recente", { n: 2 });
    jest.advanceTimersByTime(3 * 1000); // "vieille" a 11 s, "recente" 3 s

    attemptCache.sweep();

    expect(attemptCache.get("vieille")).toBeUndefined();
    expect(attemptCache.get("recente")).toEqual({ n: 2 });
  });
});
