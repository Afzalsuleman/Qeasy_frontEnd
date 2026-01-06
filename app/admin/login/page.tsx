"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TextInput from "@/components/TextInput";
import Button from "@/components/Button";
import LoadingSpinner from "@/components/LoadingSpinner";
import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/services/constants";
import { storage } from "@/services/storage";
import { useAuth } from "@/contexts/AuthContext";
import { handleApiError } from "@/services/errors";

export default function AdminLoginPage() {
  const router = useRouter();
  const { login, user } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const validateForm = (): boolean => {
    let isValid = true;

    if (!email.trim()) {
      setEmailError("Email is required");
      isValid = false;
    } else {
      setEmailError("");
    }

    if (!password.trim()) {
      setPasswordError("Password is required");
      isValid = false;
    } else {
      setPasswordError("");
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setIsLoading(true);
      setError("");

      // Login using auth context
      await login(email, password);

      // Wait a bit for state to update, then redirect based on role
      setTimeout(() => {
        // Check role from storage since context might not be updated yet
        const userData = storage.getUserData<{ role?: string }>();
        const role = userData?.role;
        
        if (role === "admin") {
          router.push("/admin/dashboard");
        } else if (role === "shop_owner") {
          router.push("/dashboard");
        } else {
          // Default to admin dashboard for login page
          router.push("/admin/dashboard");
        }
      }, 200);
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Admin Login</h1>
          <p className="text-gray-600">Sign in to access the admin dashboard</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-200">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <TextInput
              value={email}
              onChange={setEmail}
              label="Email"
              type="email"
              placeholder="admin@example.com"
              error={emailError}
              disabled={isLoading}
            />

            <TextInput
              value={password}
              onChange={setPassword}
              label="Password"
              type="password"
              placeholder="Enter your password"
              error={passwordError}
              disabled={isLoading}
            />

            <Button
              type="submit"
              variant="primary"
              fullWidth
              size="lg"
              isLoading={isLoading}
            >
              Sign In
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => router.push("/")}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

