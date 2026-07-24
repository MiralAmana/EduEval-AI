import api from "@/lib/apiClient";

export async function generateEvaluation(payload) {
  const response = await api.post(
    "/api/ai/generate-evaluation",
    payload,
    { timeout: 120000 }
  );

  return response.data;
}