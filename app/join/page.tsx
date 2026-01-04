"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ShopInfo from "@/components/ShopInfo";
import EmailInput from "@/components/EmailInput";
import OTPInput from "@/components/OTPInput";
import Button from "@/components/Button";
import LoadingSpinner from "@/components/LoadingSpinner";
import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/services/constants";
import { storage } from "@/services/storage";
import { useAuth } from "@/contexts/AuthContext";
import { isValidEmail } from "@/utils/helpers";
import { handleApiError } from "@/services/errors";

type Step = "email" | "otp" | "joining";

interface ShopData {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  queueLength: number;
  estimatedWaitTime: number;
}

export default function JoinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { sendOTP, loginWithOTP } = useAuth();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [emailError, setEmailError] = useState("");
  const [otpError, setOtpError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingShop, setIsLoadingShop] = useState(true);
  const [shopData, setShopData] = useState<ShopData | null>(null);
  const [error, setError] = useState("");

  // Mock shop data for UI preview
  const MOCK_SHOPS: Record<string, ShopData> = {
    "1": {
      id: "1",
      name: "Coffee Corner",
      address: "123 Main Street, Downtown",
      phone: "+1 (555) 123-4567",
      queueLength: 5,
      estimatedWaitTime: 15,
    },
    "2": {
      id: "2",
      name: "Burger Palace",
      address: "456 Oak Avenue, Midtown",
      phone: "+1 (555) 234-5678",
      queueLength: 12,
      estimatedWaitTime: 30,
    },
    "3": {
      id: "3",
      name: "Pizza Express",
      address: "789 Elm Street, Uptown",
      phone: "+1 (555) 345-6789",
      queueLength: 8,
      estimatedWaitTime: 20,
    },
    "4": {
      id: "4",
      name: "Sushi House",
      address: "321 Pine Road, Eastside",
      phone: "+1 (555) 456-7890",
      queueLength: 3,
      estimatedWaitTime: 10,
    },
    "5": {
      id: "5",
      name: "Taco Fiesta",
      address: "654 Maple Drive, Westside",
      phone: "+1 (555) 567-8901",
      queueLength: 20,
      estimatedWaitTime: 45,
    },
    "6": {
      id: "6",
      name: "Ice Cream Delight",
      address: "987 Cedar Lane, Northside",
      phone: "+1 (555) 678-9012",
      queueLength: 2,
      estimatedWaitTime: 5,
    },
  };

  // Get shop ID from URL params
  const shopId = searchParams.get("shopId") || searchParams.get("id");

  // Fetch shop info on mount
  useEffect(() => {
    const fetchShopInfo = async () => {
      if (!shopId) {
        setError("Shop ID is required");
        setIsLoadingShop(false);
        return;
      }

      try {
        setIsLoadingShop(true);
        // Try to fetch from API first
        try {
          const response = await api.get<ShopData>(
            `${API_ENDPOINTS.SHOP.INFO}?id=${shopId}`,
            false
          );
          setShopData(response.data);
        } catch (apiErr) {
          // Fallback to mock data if API fails (for UI preview)
          if (MOCK_SHOPS[shopId]) {
            setShopData(MOCK_SHOPS[shopId]);
          } else {
            throw apiErr;
          }
        }
      } catch (err) {
        const errorMessage = handleApiError(err);
        setError(errorMessage);
      } finally {
        setIsLoadingShop(false);
      }
    };

    fetchShopInfo();
  }, [shopId]);

  // Validate email
  const validateEmail = (): boolean => {
    if (!email.trim()) {
      setEmailError("Email is required");
      return false;
    }
    if (!isValidEmail(email)) {
      setEmailError("Please enter a valid email address");
      return false;
    }
    setEmailError("");
    return true;
  };

  // Handle email submission -> send OTP
  const handleEmailSubmit = async () => {
    if (!validateEmail()) return;

    try {
      setIsLoading(true);
      setError("");
      await sendOTP(email);
      setStep("otp");
    } catch (err) {
      const errorMessage = handleApiError(err);
      setEmailError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OTP verification -> join queue
  const handleOTPComplete = async (enteredOtp: string) => {
    if (enteredOtp.length !== 6) {
      setOtpError("Please enter a valid 6-digit OTP");
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      setOtpError("");

      // Verify OTP and login
      await loginWithOTP(email, enteredOtp);

      // Join queue
      setStep("joining");
      const response = await api.post<{ token: string; queueId: string }>(
        API_ENDPOINTS.QUEUE.JOIN,
        { shopId, email },
        true // requires auth
      );

      // Store queue token
      const { token: queueToken } = response.data;
      storage.setQueueToken(queueToken);

      // Redirect to status page
      router.push(`/status?queueId=${response.data.queueId}`);
    } catch (err) {
      const errorMessage = handleApiError(err);
      setOtpError(errorMessage);
      setStep("otp");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle resend OTP
  const handleResendOTP = async () => {
    try {
      setIsLoading(true);
      setError("");
      await sendOTP(email);
      setOtpError("");
      // Clear OTP input
      setOtp("");
    } catch (err) {
      const errorMessage = handleApiError(err);
      setOtpError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingShop) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Loading shop information...</p>
        </div>
      </div>
    );
  }

  if (error && !shopData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-md">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={() => router.push("/")} variant="primary">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  if (!shopData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Shop Info */}
        <ShopInfo
          shopName={shopData.name}
          queueLength={shopData.queueLength}
          estimatedWaitTime={shopData.estimatedWaitTime}
          shopAddress={shopData.address}
          shopPhone={shopData.phone}
        />

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Email Step */}
        {step === "email" && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Join the Queue
            </h2>
            <p className="text-gray-600 mb-6">
              Enter your email to receive an OTP and join the queue
            </p>

            <div className="space-y-4">
              <EmailInput
                value={email}
                onChange={setEmail}
                onBlur={validateEmail}
                error={emailError}
                disabled={isLoading}
                placeholder="your.email@example.com"
              />

              <Button
                onClick={handleEmailSubmit}
                isLoading={isLoading}
                fullWidth
                variant="primary"
                size="lg"
              >
                Send OTP
              </Button>
            </div>
          </div>
        )}

        {/* OTP Step */}
        {step === "otp" && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Enter OTP
            </h2>
            <p className="text-gray-600 mb-2">
              We sent a 6-digit code to
            </p>
            <p className="text-gray-900 font-semibold mb-6">{email}</p>

            <div className="space-y-6">
              <OTPInput
                length={6}
                onComplete={handleOTPComplete}
                error={otpError}
                disabled={isLoading}
              />

              <div className="text-center">
                <button
                  onClick={handleResendOTP}
                  disabled={isLoading}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Resend OTP
                </button>
              </div>

              <Button
                onClick={() => setStep("email")}
                variant="secondary"
                fullWidth
                disabled={isLoading}
              >
                Change Email
              </Button>
            </div>
          </div>
        )}

        {/* Joining Step */}
        {step === "joining" && (
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <LoadingSpinner size="lg" className="mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Joining Queue...
            </h2>
            <p className="text-gray-600">
              Please wait while we add you to the queue
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
