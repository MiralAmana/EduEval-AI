const { chunkPagesByCharBudget } = require("../pdfChunking");

function buildPage(num, length) {
  return { num, text: "x".repeat(length) };
}

describe("chunkPagesByCharBudget", () => {
  it("regroupe toutes les pages dans un seul chunk si le budget suffit", () => {
    const pages = [buildPage(1, 100), buildPage(2, 100), buildPage(3, 100)];

    const chunks = chunkPagesByCharBudget(pages, 1000);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual(pages);
  });

  it("démarre un nouveau chunk plutôt que de dépasser le budget", () => {
    const pages = [buildPage(1, 600), buildPage(2, 600), buildPage(3, 600)];

    const chunks = chunkPagesByCharBudget(pages, 1000);

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toEqual([pages[0]]);
    expect(chunks[1]).toEqual([pages[1]]);
    expect(chunks[2]).toEqual([pages[2]]);
  });

  it("ne coupe jamais une page en deux, même si elle dépasse le budget à elle seule", () => {
    const pages = [buildPage(1, 2000)];

    const chunks = chunkPagesByCharBudget(pages, 1000);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual(pages);
  });

  it("regroupe les pages tant que le budget n'est pas dépassé", () => {
    const pages = [
      buildPage(1, 400),
      buildPage(2, 400),
      buildPage(3, 400),
      buildPage(4, 400),
    ];

    const chunks = chunkPagesByCharBudget(pages, 1000);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toEqual([pages[0], pages[1]]);
    expect(chunks[1]).toEqual([pages[2], pages[3]]);
  });

  it("renvoie un tableau vide pour un document sans page", () => {
    expect(chunkPagesByCharBudget([], 1000)).toEqual([]);
  });
});
