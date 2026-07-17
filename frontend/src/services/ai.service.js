import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:3000",
  timeout: 120000,
});

export async function generateEvaluation(payload) {
  const response = await api.post(
    "/api/ai/generate-evaluation",
    payload
  );

  return response.data;
}