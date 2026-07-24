import api from "@/lib/apiClient";

export async function extractPdf(file) {
  const formData = new FormData();

  formData.append("file", file);

  const response = await api.post(
    "/api/pdf/extract",
    formData,
    { timeout: 120000 }
  );

  return response.data;
}