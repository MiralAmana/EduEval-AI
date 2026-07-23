function echapperRegex(texte) {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function corriger(texte, exercice) {
  let score = 0;
  const details = [];

  const nombreDeMots = texte.trim().split(/\s+/).length;

  const nombreDeParagraphes = texte
    .split(/\n+/)
    .map((paragraphe) => paragraphe.trim())
    .filter(Boolean).length;

  for (const critere of exercice.criteres) {
    let reussi = false;

    switch (critere.type) {
      case "nombre_mots_min":
        reussi = nombreDeMots >= critere.valeur;
        break;

      case "mot_obligatoire":
        reussi = new RegExp(
          `\\b${echapperRegex(critere.valeur)}\\b`,
          "i"
        ).test(texte);
        break;

      case "nombre_paragraphes_min":
        reussi = nombreDeParagraphes >= critere.valeur;
        break;

      default:
        reussi = false;
        break;
    }

    if (reussi) {
      score += critere.points;
    }

    details.push({
      type: critere.type,
      reussi,
      pointsObtenus: reussi ? critere.points : 0,
    });
  }

  return {
    score,
    nombreDeMots,
    nombreDeParagraphes,
    details,
  };
}

module.exports = corriger;
