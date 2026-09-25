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

  console.error(error);

  return res.status(error.status || 500).json({
    message: error.message || "Une erreur interne est survenue.",
  });
}

module.exports = { errorHandler };
