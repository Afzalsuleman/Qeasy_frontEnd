"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import Button from "@/components/Button";
import ConfirmDialog from "@/components/ConfirmDialog";
import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/services/constants";
import { storage } from "@/services/storage";
import { useAuth } from "@/contexts/AuthContext";
import { handleApiError } from "@/services/errors";
import { formatTimeHuman } from "@/utils/helpers";

interface QueuePositionData {
  shopId: string;
  shopName: string;
  userId: string;
  userName: string;
  userEmail: string;
  position: number;
  status: string;
  totalInQueue: number;
  peopleAhead: number;
  estimatedWaitTimeMinutes: number;
}

export default function StatusPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();

  const [queueData, setQueueData] = useState<QueuePositionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveSuccess, setLeaveSuccess] = useState(false);
  const shouldPollRef = useRef(true);

  const shopId = searchParams.get("shopId");

  // Fetch queue position
  useEffect(() => {
    const fetchQueuePosition = async () => {
      if (!shopId) {
        setError("Shop ID is required");
        setIsLoading(false);
        return;
      }

      if (!isAuthenticated) {
        router.push("/");
        return;
      }

      if (!shouldPollRef.current) return;

      try {
        setIsLoading(true);
        setError("");

        const response = await api.get<QueuePositionData>(
          `${API_ENDPOINTS.QUEUE.POSITION}/${shopId}`,
          true // requires auth
        );

        setQueueData(response.data);
        // Update stored queue data
        storage.setQueueData(response.data);
      } catch (err) {
        const errorMessage = handleApiError(err);
        setError(errorMessage);
        console.error("Error fetching queue position:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchQueuePosition();

    // Poll for updates every 10 seconds
    const interval = setInterval(() => {
      if (shouldPollRef.current) {
        fetchQueuePosition();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [shopId, isAuthenticated, router]);

  // Handle leave queue
  const handleLeaveQueue = async () => {
    if (!shopId) return;

    try {
      setIsLeaving(true);
      setError("");
      shouldPollRef.current = false; // Stop polling

      await api.delete(
        `${API_ENDPOINTS.QUEUE.LEAVE}/${shopId}`,
        true // requires auth
      );

      // Clear queue data
      storage.removeQueueData();
      storage.removeQueueToken();
      storage.removeShopId();

      // Show success message
      setLeaveSuccess(true);

      // Navigate to home page after 2 seconds
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      setShowLeaveConfirm(false);
      shouldPollRef.current = true; // Resume polling on error
    } finally {
      setIsLeaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Loading queue status...</p>
        </div>
      </div>
    );
  }

  if (error && !queueData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={() => router.push("/")} variant="primary">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  if (!queueData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {queueData.shopName}
          </h1>
          <p className="text-gray-600">Queue Status</p>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-6 border border-gray-200">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-[#4f46e5] bg-opacity-10 rounded-full mb-4">
              <span className="text-5xl font-bold text-[#4f46e5]">
                {queueData.position}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Your Position
            </h2>
            <p className="text-gray-600">
              {queueData.peopleAhead === 0
                ? "You're next!"
                : `${queueData.peopleAhead} ${queueData.peopleAhead === 1 ? "person" : "people"} ahead of you`}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">Total in Queue</p>
              <p className="text-2xl font-bold text-gray-900">
                {queueData.totalInQueue}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">Est. Wait Time</p>
              <p className="text-2xl font-bold text-[#4f46e5]">
                {queueData.estimatedWaitTimeMinutes === 0
                  ? "Now"
                  : `${queueData.estimatedWaitTimeMinutes} min`}
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div className="text-center">
            <span
              className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
                queueData.status === "JOINED"
                  ? "bg-green-100 text-green-800"
                  : queueData.status === "CALLED"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {queueData.status}
            </span>
          </div>
        </div>

        {/* User Info */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Your Information
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Name:</span>
              <span className="text-gray-900 font-medium">
                {queueData.userName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Email:</span>
              <span className="text-gray-900 font-medium">
                {queueData.userEmail}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-4">
          <div className="flex gap-4">
            <Button
              onClick={() => router.push("/")}
              variant="secondary"
              fullWidth
            >
              Back to Shops
            </Button>
            <Button
              onClick={() => window.location.reload()}
              variant="primary"
              fullWidth
            >
              Refresh Status
            </Button>
          </div>

          <Button
            onClick={() => setShowLeaveConfirm(true)}
            variant="danger"
            fullWidth
          >
            Leave Queue
          </Button>
        </div>
      </div>

      {/* Leave Queue Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        onConfirm={handleLeaveQueue}
        title="Leave Queue?"
        message="Are you sure you want to leave the queue? You will lose your position."
        confirmText="Leave Queue"
        cancelText="Cancel"
        variant="danger"
        isLoading={isLeaving}
      />

      {/* Leave Success Message */}
      {leaveSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-8 shadow-2xl max-w-md mx-4 text-center">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Successfully Left Queue
            </h2>
            <p className="text-gray-600 mb-4">
              You have been removed from the queue.
            </p>
            <p className="text-sm text-gray-500">
              Redirecting to shops page...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
