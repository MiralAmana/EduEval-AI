function corriger(texte, exercice) {
  let score = 0;
  const details = [];

  const nombreDeMots = texte.trim().split(/\s+/).length;

  for (const critere of exercice.criteres) {
    switch (critere.type) {
      case "nombre_mots_min":
  if (nombreDeMots >= critere.valeur) {
    score += critere.points;

    details.push({
      type: critere.type,
      reussi: true,
      pointsObtenus: critere.points,
    });
  } else {
    details.push({
      type: critere.type,
      reussi: false,
      pointsObtenus: 0,
    });
  }

  break;
    }
  }

  return {
  score: score,
  nombreDeMots: nombreDeMots,
  details: details,
};
}

module.exports = corriger;