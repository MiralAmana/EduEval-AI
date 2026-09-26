import api from "@/lib/apiClient";

export async function createEvaluation(payload) {
  console.log(
    "Création de l’évaluation :",
    payload
  );

  const response = await api.post(
    "/api/evaluations",
    payload
  );

  return response.data;
}

export async function getEvaluations() {
  const response = await api.get(
    "/api/evaluations"
  );

  return response.data;
}

// Participants de toutes les évaluations, déjà groupés par évaluation
// (page « Étudiants ») : [{ evaluationId, evaluationTitle, attempts: [...] }].
export async function getParticipants() {
  const response = await api.get(
    "/api/evaluations/participants"
  );

  return response.data;
}

export async function getEvaluationById(
  evaluationId
) {
  const response = await api.get(
    `/api/evaluations/${evaluationId}`
  );

  return response.data;
}

export async function updateEvaluation(
  evaluationId,
  payload
) {
  const response = await api.put(
    `/api/evaluations/${evaluationId}`,
    payload
  );

  return response.data;
}

export async function deleteEvaluation(
  evaluationId
) {
  const response = await api.delete(
    `/api/evaluations/${evaluationId}`
  );

  return response.data;
}

export async function duplicateEvaluation(
  evaluationId
) {
  const response = await api.post(
    `/api/evaluations/${evaluationId}/duplicate`
  );

  return response.data;
}

export async function updateEvaluationStatus(
  evaluationId,
  status
) {
  const response = await api.patch(
    `/api/evaluations/${evaluationId}/status`,
    {
      status,
    }
  );

  return response.data;
}

export async function getQuestionAnswers(evaluationId, questionId) {
  const response = await api.get(
    `/api/evaluations/${evaluationId}/questions/${questionId}/answers`
  );

  return response.data;
}