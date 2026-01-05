"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import ShopInfo from "./ShopInfo";
import EmailInput from "./EmailInput";
import TextInput from "./TextInput";
import OTPInput from "./OTPInput";
import Button from "./Button";
import LoadingSpinner from "./LoadingSpinner";
import Celebration from "./Celebration";
import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/services/constants";
import { storage } from "@/services/storage";
import { useAuth } from "@/contexts/AuthContext";
import { isValidEmail } from "@/utils/helpers";
import { handleApiError } from "@/services/errors";

type Step = "email" | "otp" | "joining" | "celebrating";

interface ShopData {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  queueLength: number;
  estimatedWaitTime: number;
}

export interface JoinQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopData: ShopData;
}

export default function JoinQueueModal({
  isOpen,
  onClose,
  shopData,
}: JoinQueueModalProps) {
  const router = useRouter();
  const { sendOTP, loginWithOTP } = useAuth();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [emailError, setEmailError] = useState("");
  const [otpError, setOtpError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Reset state when modal closes
  const handleClose = () => {
    setStep("email");
    setEmail("");
    setName("");
    setOtp("");
    setEmailError("");
    setOtpError("");
    setError("");
    setSuccessMessage("");
    setIsLoading(false);
    onClose();
  };

  // Handle celebration complete
  const handleCelebrationComplete = () => {
    handleClose();
    router.push(`/status?shopId=${shopData.id}`);
  };

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
      // Use provided name or extract from email
      const userName = name.trim() || email.split("@")[0];
      await sendOTP(email, userName);
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
      const response = await api.post<{
        shopId: string;
        shopName: string;
        userId: string;
        userName: string;
        userEmail: string;
        position: number;
        status: string;
        peopleAhead: number;
        estimatedWaitTimeMinutes: number;
        joinedAt: string;
        message: string;
      }>(
        API_ENDPOINTS.QUEUE.JOIN,
        { shopId: shopData.id },
        true // requires auth
      );

      // Store queue data
      storage.setQueueData(response.data);
      storage.setShopId(response.data.shopId);

      // Show celebration
      setSuccessMessage(response.data.message || "You have successfully joined the queue!");
      setStep("celebrating");
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
      const userName = name.trim() || email.split("@")[0];
      await sendOTP(email, userName);
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

  return (
    <>
    <Modal isOpen={isOpen && step !== "celebrating"} onClose={handleClose} size="md">
      <div className="space-y-6">
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
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Email Step */}
        {step === "email" && (
          <>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Join the Queue
              </h2>
              <p className="text-gray-600">
                Enter your email to receive an OTP and join the queue
              </p>
            </div>

            <div className="space-y-4">
              <TextInput
                value={name}
                onChange={setName}
                label="Name (Optional)"
                placeholder="Your name"
                disabled={isLoading}
              />

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
          </>
        )}

        {/* OTP Step */}
        {step === "otp" && (
          <>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Enter OTP
              </h2>
              <p className="text-gray-600 mb-2">
                We sent a 6-digit code to
              </p>
              <p className="text-gray-900 font-semibold">{email}</p>
            </div>

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

              <div className="flex gap-3">
                <Button
                  onClick={() => setStep("email")}
                  variant="secondary"
                  fullWidth
                  disabled={isLoading}
                >
                  Change Email
                </Button>
                <Button
                  onClick={handleClose}
                  variant="secondary"
                  fullWidth
                  disabled={isLoading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Joining Step */}
        {step === "joining" && (
          <div className="text-center py-8">
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
    </Modal>

    {/* Celebration - rendered outside modal */}
    {step === "celebrating" && successMessage && (
      <Celebration
        message={successMessage}
        onComplete={handleCelebrationComplete}
      />
    )}
    </>
  );
}

