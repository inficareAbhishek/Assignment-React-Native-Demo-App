// src/context/AuthContext.tsx
import React, { createContext, useState, useEffect } from "react";
import EncryptedStorage from "react-native-encrypted-storage";

type AuthContextType = {
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
};

export const AuthContext = createContext<AuthContextType>({
  token: null,
  login: async () => {},
  logout: async () => {},
  loading: true,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper function to safely store token
  const storeToken = async (token: string) => {
    try {
      await EncryptedStorage.setItem("jwt_token", token);
    } catch (err) {
      console.log("Storage error:", err);
    }
  };

    useEffect(() => {
    const loadToken = async () => {
      try {
        const savedToken = await EncryptedStorage.getItem("jwt_token");
        if (savedToken) setToken(savedToken); // ✅ set token if exists
      } catch (err) {
        console.log("Error loading token:", err);
      } finally {
        setLoading(false); // ✅ finished loading
      }
    };
    loadToken();
  }, []);

  // Check if token exists on app start
  useEffect(() => {
    const loadToken = async () => {
      try {
        const savedToken = await EncryptedStorage.getItem("jwt_token");
        if (savedToken) setToken(savedToken);
      } catch (e) {
        console.log("Error loading token", e);
      } finally {
        setLoading(false);
      }
    };
    loadToken();
  }, []);

const USE_MOCK_LOGIN = true;

const login = async (email: string, password: string) => {
  setLoading(true);
  try {
    // ✅ Only accept specific credentials
    if (email === "a@g.com" && password === "123456789") {
      const fakeToken = "mocked_token_123456";

      await storeToken(fakeToken);  // save securely
      setToken(fakeToken);          // update context state
      console.log("✅ Mock login successful");
    } else {
      throw new Error("Invalid credentials");
    }
  } catch (err) {
    console.log("Login error:", err);
    throw err; // propagate to LoginScreen so you can show an alert
  } finally {
    setLoading(false);
  }
};

  const logout = async () => {
    setLoading(true);
    try {
      await EncryptedStorage.removeItem("jwt_token");
      setToken(null);
    } catch (err) {
      console.log("Logout error:", err);
    } finally {
      setLoading(false);
    }
  };

    return (
    <AuthContext.Provider value={{ token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
