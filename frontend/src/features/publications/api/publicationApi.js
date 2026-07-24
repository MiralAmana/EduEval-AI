import api from "@/lib/apiClient";

export async function getPublication(publicationId) {
  const response = await api.get(
    `/api/publications/${publicationId}`
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
