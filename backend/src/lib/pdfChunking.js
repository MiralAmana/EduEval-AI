const DEFAULT_MAX_CHUNK_CHARS = 8000;
const DEFAULT_MAX_CHUNKS = 12;

/**
 * Découpe le texte d'un PDF en groupes de pages, sans jamais couper
 * une page en deux, pour rester sous un budget de caractères par
 * appel IA. Évite d'injecter un document entier dans un seul prompt
 * (risque de dépassement de contexte / perte de précision sur les
 * gros documents).
 */
function chunkPagesByCharBudget(
  pages,
  maxChunkChars = DEFAULT_MAX_CHUNK_CHARS
) {
  const chunks = [];
  let current = [];
  let currentLength = 0;

  for (const page of pages) {
    const pageText = page.text || "";

    if (
      currentLength > 0 &&
      currentLength + pageText.length > maxChunkChars
    ) {
      chunks.push(current);
      current = [];
      currentLength = 0;
    }

    current.push(page);
    currentLength += pageText.length;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

module.exports = {
  DEFAULT_MAX_CHUNK_CHARS,
  DEFAULT_MAX_CHUNKS,
  chunkPagesByCharBudget,
};
