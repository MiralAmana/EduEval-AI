import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:3000",
  timeout: 30000,
  withCredentials: true,
});

export async function joinEvaluation(payload) {
  const response = await api.post("/api/attempts/join", payload);

  return response.data;
}

export async function getAttempt(attemptId) {
  const response = await api.get(`/api/attempts/${attemptId}`);

  return response.data;
}

export async function saveAnswer(attemptId, questionId, textAnswer) {
  const response = await api.put(
    `/api/attempts/${attemptId}/answers/${questionId}`,
    { textAnswer }
  );

  return response.data;
}

export async function saveFileAnswer(attemptId, questionId, file) {
  const formData = new FormData();

  formData.append("file", file);

  const response = await api.post(
    `/api/attempts/${attemptId}/answers/${questionId}/file`,
    formData
  );

  return response.data;
}

export async function registerExit(attemptId) {
  const response = await api.post(`/api/attempts/${attemptId}/exit`);

  return response.data;
}

export async function submitAttempt(attemptId) {
  const response = await api.post(`/api/attempts/${attemptId}/submit`);

  return response.data;
}

export async function reviewAttempt(attemptId) {
  const response = await api.get(`/api/attempts/${attemptId}/review`);

  return response.data;
}

export async function gradeAnswer(attemptId, questionId, { score, feedback }) {
  const response = await api.put(
    `/api/attempts/${attemptId}/answers/${questionId}/grade`,
    { score, feedback }
  );

  return response.data;
}

export async function gradeAnswerWithAi(attemptId, questionId) {
  const response = await api.post(
    `/api/attempts/${attemptId}/answers/${questionId}/grade-ai`
  );

  return response.data;
}

export async function publishResults(attemptId) {
  const response = await api.post(`/api/attempts/${attemptId}/publish`);

  return response.data;
}
