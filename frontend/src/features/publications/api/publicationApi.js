import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:3000",
  timeout: 30000,
  withCredentials: true,
});

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
