// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, next) {
  // Une erreur axios vient d'un service externe (Groq) : son `status` est
  // celui de l'amont (ex. 404 modèle introuvable, 401 clé invalide), pas
  // celui de notre API. Le renvoyer tel quel fausserait le diagnostic
  // côté client, on répond donc 502 et on garde le détail dans les logs.
  if (error.isAxiosError) {
    console.error(
      "Erreur du service externe :",
      error.config?.url,
      error.response?.status,
      JSON.stringify(error.response?.data) || error.message
    );

    return res.status(502).json({
      message:
        "Le service d’IA est momentanément indisponible. Réessaie dans quelques instants.",
    });
  }

  // Refus de multer (fichier trop gros, champ inattendu…) : erreur du client,
  // pas du serveur. Sans ça, un élève qui dépose un fichier trop lourd
  // recevait un 500 « File too large » en anglais.
  if (error.name === "MulterError") {
    const tooLarge = error.code === "LIMIT_FILE_SIZE";

    return res.status(tooLarge ? 413 : 400).json({
      message: tooLarge
        ? "Fichier trop volumineux (10 Mo maximum)."
        : "Fichier invalide.",
    });
  }

  console.error(error);

  return res.status(error.status || 500).json({
    message: error.message || "Une erreur interne est survenue.",
  });
}

module.exports = { errorHandler };
