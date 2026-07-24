import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import { getStoredToken } from "@/lib/apiClient";
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
} from "@/services/auth.service";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getStoredToken()) {
      setLoading(false);
      return;
    }

    getCurrentUser()
      .then(({ user: currentUser }) => setUser(currentUser))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(payload) {
    const { user: loggedInUser } = await loginUser(payload);

    setUser(loggedInUser);

    return loggedInUser;
  }

  async function register(payload) {
    const { user: createdUser } = await registerUser(payload);

    setUser(createdUser);

    return createdUser;
  }

  async function logout() {
    await logoutUser();

    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth doit être utilisé dans un AuthProvider.");
  }

  return context;
}
