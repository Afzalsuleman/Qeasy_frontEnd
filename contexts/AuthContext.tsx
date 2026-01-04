"use client";

/**
 * Auth Context for state management
 * Handles authentication state for both customers and shop owners
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { storage } from "@/services/storage";
import { STORAGE_KEYS } from "@/services/constants";
import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/services/constants";

export interface User {
  id: string;
  email: string;
  name?: string;
  role?: "customer" | "shop_owner";
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  loginWithOTP: (email: string, otp: string) => Promise<void>;
  sendOTP: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Initialize auth state from storage
  useEffect(() => {
    const initializeAuth = () => {
      try {
        const token = storage.getAuthToken();
        const user = storage.getUserData<User>();

        if (token && user) {
          setState({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
        } else {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    };

    initializeAuth();
  }, []);

  /**
   * Login with email and password (for shop owners)
   */
  const login = useCallback(async (email: string, password: string) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true }));

      const response = await api.post<{
        token: string;
        user: User;
      }>(
        API_ENDPOINTS.AUTH.LOGIN,
        { email, password },
        false
      );

      const { token, user } = response.data;

      storage.setAuthToken(token);
      storage.setUserData(user);

      setState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      setState((prev) => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  /**
   * Send OTP to email
   */
  const sendOTP = useCallback(async (email: string, name?: string) => {
    try {
      await api.post(
        API_ENDPOINTS.AUTH.GENERATE_OTP,
        { email, name: name || email.split("@")[0] }, // Use email prefix as default name if not provided
        false
      );
    } catch (error) {
      throw error;
    }
  }, []);

  /**
   * Login with OTP (for customers)
   */
  const loginWithOTP = useCallback(async (email: string, otp: string) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true }));

      const response = await api.post<{
        userId: string;
        email: string;
        name: string;
        token: string;
        message: string;
        expiresIn: number;
      }>(
        API_ENDPOINTS.AUTH.VERIFY_OTP,
        { email, otp },
        false
      );

      const { token, userId, email: userEmail, name } = response.data;

      // Map API response to User interface
      const user: User = {
        id: userId,
        email: userEmail,
        name: name,
        role: "customer",
      };

      storage.setAuthToken(token);
      storage.setUserData(user);

      setState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      setState((prev) => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  /**
   * Logout
   */
  const logout = useCallback(async () => {
    try {
      // Call logout API if token exists
      const token = storage.getAuthToken();
      if (token) {
        try {
          await api.post(API_ENDPOINTS.AUTH.LOGOUT, {}, true);
        } catch (error) {
          // Continue with logout even if API call fails
          console.error("Logout API call failed:", error);
        }
      }

      // Clear storage
      storage.removeAuthToken();
      storage.removeUserData();
      storage.removeQueueToken();
      storage.removeShopId();

      setState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    } catch (error) {
      console.error("Error during logout:", error);
      // Still clear local state even if logout fails
      storage.removeAuthToken();
      storage.removeUserData();
      setState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  }, []);

  /**
   * Update user data
   */
  const updateUser = useCallback((userData: Partial<User>) => {
    setState((prev) => {
      if (!prev.user) return prev;

      const updatedUser = { ...prev.user, ...userData };
      storage.setUserData(updatedUser);

      return {
        ...prev,
        user: updatedUser,
      };
    });
  }, []);

  const value: AuthContextType = {
    ...state,
    login,
    loginWithOTP,
    sendOTP,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to use auth context
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

