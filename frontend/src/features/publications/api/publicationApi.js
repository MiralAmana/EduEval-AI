import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:3000",
  timeout: 30000,
  withCredentials: true,
});

export async function getPublications(evaluationId) {
  const response = await api.get(
    `/api/evaluations/${evaluationId}/publications`
  );

  return response.data;
}

export async function getPublication(publicationId) {
  const response = await api.get(
    `/api/publications/${publicationId}`
  );

  return response.data;
}

export async function createPublication(
  evaluationId,
  payload
) {
  const response = await api.post(
    `/api/evaluations/${evaluationId}/publications`,
    payload
  );

  return response.data;
}

export async function updatePublication(
  publicationId,
  payload
) {
  const response = await api.put(
    `/api/publications/${publicationId}`,
    payload
  );

  return response.data;
}

export async function deletePublication(publicationId) {
  const response = await api.delete(
    `/api/publications/${publicationId}`
  );

  return response.data;
}

export async function activatePublication(publicationId) {
  const response = await api.patch(
    `/api/publications/${publicationId}/activate`
  );

  return response.data;
}

export async function deactivatePublication(publicationId) {
  const response = await api.patch(
    `/api/publications/${publicationId}/deactivate`
  );

  return response.data;
}

export async function closePublication(publicationId) {
  const response = await api.patch(
    `/api/publications/${publicationId}/close`
  );

  return response.data;
}

export async function reopenPublication(publicationId) {
  const response = await api.patch(
    `/api/publications/${publicationId}/reopen`
  );

  return response.data;
}

export async function duplicatePublication(publicationId) {
  const response = await api.post(
    `/api/publications/${publicationId}/duplicate`
  );

  return response.data;
}

export async function regenerateAccessCode(
  publicationId
) {
  const response = await api.patch(
    `/api/publications/${publicationId}/regenerate-code`
  );

  return response.data;
}

export async function getPublicationStatistics(
  publicationId
) {
  const response = await api.get(
    `/api/publications/${publicationId}/statistics`
  );

  return response.data;
}

export async function getPublicationParticipants(
  publicationId
) {
  const response = await api.get(
    `/api/publications/${publicationId}/participants`
  );

  return response.data;
}

export async function getPublicationAttempts(
  publicationId
) {
  const response = await api.get(
    `/api/publications/${publicationId}/attempts`
  );

  return response.data;
}

export async function exportPublicationCSV(
  publicationId
) {
  const response = await api.get(
    `/api/publications/${publicationId}/export/csv`,
    {
      responseType: "blob",
    }
  );

  return response.data;
}

export async function exportPublicationExcel(
  publicationId
) {
  const response = await api.get(
    `/api/publications/${publicationId}/export/excel`,
    {
      responseType: "blob",
    }
  );

  return response.data;
}

export async function exportPublicationPDF(
  publicationId
) {
  const response = await api.get(
    `/api/publications/${publicationId}/export/pdf`,
    {
      responseType: "blob",
    }
  );

  return response.data;
}