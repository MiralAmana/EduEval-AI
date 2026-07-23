import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:3000",
  timeout: 30000,
  withCredentials: true,
});

export async function registerUser(payload) {
  const response = await api.post("/api/auth/register", payload);

  return response.data;
}

export async function loginUser(payload) {
  const response = await api.post("/api/auth/login", payload);

  return response.data;
}

export async function logoutUser() {
  const response = await api.post("/api/auth/logout");

  return response.data;
}

export async function getCurrentUser() {
  const response = await api.get("/api/auth/me");

  return response.data;
}
