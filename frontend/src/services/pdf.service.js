import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:3000",
  timeout: 120000,
  withCredentials: true,
});

export async function extractPdf(file) {
  const formData = new FormData();

  formData.append("file", file);

  const response = await api.post(
    "/api/pdf/extract",
    formData
  );

  return response.data;
}