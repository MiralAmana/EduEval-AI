import api, { setStoredToken } from "@/lib/apiClient";

export async function registerUser(payload) {
  const response = await api.post("/api/auth/register", payload);

  setStoredToken(response.data.token);

  return response.data;
}

export async function loginUser(payload) {
  const response = await api.post("/api/auth/login", payload);

  setStoredToken(response.data.token);

  return response.data;
}

export async function logoutUser() {
  const response = await api.post("/api/auth/logout");

  setStoredToken(null);

  return response.data;
}

export async function getCurrentUser() {
  const response = await api.get("/api/auth/me");

  return response.data;
}
