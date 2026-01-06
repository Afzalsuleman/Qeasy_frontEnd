"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import Button from "@/components/Button";
import ConfirmDialog from "@/components/ConfirmDialog";
import { api } from "@/services/api";
import { API_ENDPOINTS, WS_EVENTS } from "@/services/constants";
import { storage } from "@/services/storage";
import { useAuth } from "@/contexts/AuthContext";
import { handleApiError } from "@/services/errors";
import { formatTimeHuman } from "@/utils/helpers";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { WebSocketEventType } from "@/services/websocket";

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
  const { isAuthenticated, token } = useAuth();

  const [queueData, setQueueData] = useState<QueuePositionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveSuccess, setLeaveSuccess] = useState(false);
  const [isConfirmingArrival, setIsConfirmingArrival] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [showAutoCancelWarning, setShowAutoCancelWarning] = useState(false);
  const shouldPollRef = useRef(true);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoCancelTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const shopId = searchParams.get("shopId");

  // WebSocket connection for real-time updates
  const { isConnected, on, off } = useWebSocket({
    path: shopId ? `/queue/${shopId}` : "",
    autoConnect: !!shopId && !!isAuthenticated,
    onConnect: () => {
      console.log("WebSocket connected for queue updates");
    },
    onDisconnect: () => {
      console.log("WebSocket disconnected");
    },
    onError: (error) => {
      console.error("WebSocket error:", error);
    },
  });

  // Fetch queue position
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

      // Calculate countdown timer
      if (response.data.estimatedWaitTimeMinutes > 0) {
        const waitTimeSeconds = response.data.estimatedWaitTimeMinutes * 60;
        setRemainingSeconds(waitTimeSeconds);
      } else {
        setRemainingSeconds(0);
      }

      // Show auto-cancel warning if position is high (e.g., > 10)
      if (response.data.position > 10) {
        setShowAutoCancelWarning(true);
      }
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      console.error("Error fetching queue position:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch and polling
  useEffect(() => {
    fetchQueuePosition();

    // Poll for updates every 10 seconds (as fallback if WebSocket fails)
    const interval = setInterval(() => {
      if (shouldPollRef.current && !isConnected) {
        fetchQueuePosition();
      }
    }, 10000);

    return () => {
      clearInterval(interval);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      if (autoCancelTimeoutRef.current) {
        clearTimeout(autoCancelTimeoutRef.current);
      }
    };
  }, [shopId, isAuthenticated, router, isConnected]);

  // ETA Countdown Timer
  useEffect(() => {
    if (remainingSeconds === null || remainingSeconds <= 0) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      return;
    }

    countdownIntervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null || prev <= 0) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [remainingSeconds]);

  // Format countdown time
  const formatCountdown = (seconds: number): string => {
    if (seconds <= 0) return "Now";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // WebSocket event handlers
  useEffect(() => {
    if (!isConnected || !shopId) return;

    // Handle QUEUE_UPDATED event
    const handleQueueUpdated = (data: unknown) => {
      console.log("Queue updated via WebSocket:", data);
      const updateData = data as Partial<QueuePositionData>;
      
      setQueueData((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, ...updateData };
        
        // Update countdown if estimated wait time changed
        if (updateData.estimatedWaitTimeMinutes !== undefined) {
          const waitTimeSeconds = updateData.estimatedWaitTimeMinutes * 60;
          setRemainingSeconds(waitTimeSeconds);
        }
        
        return updated;
      });
    };

    // Handle TOKEN_CALLED event
    const handleTokenCalled = (data: unknown) => {
      console.log("Token called via WebSocket:", data);
      const callData = data as { userId?: string; position?: number };
      
      // Check if this is for the current user
      if (callData.userId === queueData?.userId || callData.position === queueData?.position) {
        // Refresh queue data
        fetchQueuePosition();
        
        // Show notification or update UI
        setQueueData((prev) => {
          if (!prev) return prev;
          return { ...prev, status: "CALLED" };
        });
      } else {
        // Someone else was called, just refresh
        fetchQueuePosition();
      }
    };

    // Subscribe to events
    const unsubscribeQueueUpdated = on(WS_EVENTS.QUEUE_UPDATED as WebSocketEventType, handleQueueUpdated);
    const unsubscribeTokenCalled = on(WS_EVENTS.TOKEN_CALLED as WebSocketEventType, handleTokenCalled);

    return () => {
      unsubscribeQueueUpdated();
      unsubscribeTokenCalled();
    };
  }, [isConnected, shopId, on, queueData?.userId, queueData?.position]);

  // Handle arrival confirmation
  const handleConfirmArrival = async () => {
    if (!shopId) return;

    try {
      setIsConfirmingArrival(true);
      setError("");

      await api.post(
        API_ENDPOINTS.QUEUE.CONFIRM_ARRIVAL,
        { shopId },
        true // requires auth
      );

      // Update status
      setQueueData((prev) => {
        if (!prev) return prev;
        return { ...prev, status: "ARRIVED" };
      });

      // Show success message
      alert("Arrival confirmed! Please proceed to the counter.");
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      console.error("Error confirming arrival:", err);
    } finally {
      setIsConfirmingArrival(false);
    }
  };

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

  if (isLoading && !queueData) {
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
        {/* WebSocket Connection Status */}
        {isConnected && (
          <div className="mb-4 flex items-center justify-center gap-2 text-sm text-green-600">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Live updates active</span>
          </div>
        )}

        {/* Auto-Cancel Warning Banner */}
        {showAutoCancelWarning && queueData.position > 10 && (
          <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-800 mb-1">
                  High Queue Position
                </h3>
                <p className="text-sm text-yellow-700">
                  Your position is quite high. The queue may auto-cancel if you don't arrive in time. Please keep an eye on your position.
                </p>
              </div>
              <button
                onClick={() => setShowAutoCancelWarning(false)}
                className="text-yellow-600 hover:text-yellow-800"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {queueData.shopName}
          </h1>
          <p className="text-gray-600">Queue Status</p>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-6 border border-gray-200">
          {queueData.position === 1 || queueData.peopleAhead === 0 ? (
            // Special UI when customer is next
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-32 h-32 bg-gradient-to-br from-green-100 to-green-200 rounded-full mb-6 animate-pulse">
                <span className="text-7xl">🎉</span>
              </div>
              <h2 className="text-4xl font-bold text-green-600 mb-4">
                It's Your Turn!
              </h2>
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 mb-4 border-2 border-green-200">
                <p className="text-2xl font-semibold text-green-800 mb-2">
                  Enjoy the Menu! 🍽️
                </p>
                <p className="text-green-700">
                  You're next in line. Please proceed to the counter.
                </p>
              </div>
              <div className="inline-flex items-center justify-center w-20 h-20 bg-[#4f46e5] bg-opacity-10 rounded-full">
                <span className="text-4xl font-bold text-[#4f46e5]">
                  {queueData.position}
                </span>
              </div>
            </div>
          ) : (
            // Regular UI for other positions
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
          )}

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

          {/* ETA Countdown Timer */}
          {remainingSeconds !== null && remainingSeconds > 0 && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-6 border border-blue-200">
              <div className="text-center">
                <p className="text-sm text-blue-600 font-medium mb-2">
                  Estimated Time Remaining
                </p>
                <p className="text-3xl font-bold text-blue-900">
                  {formatCountdown(remainingSeconds)}
                </p>
              </div>
            </div>
          )}

          {/* Status Badge */}
          <div className="text-center">
            <span
              className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
                queueData.status === "JOINED"
                  ? "bg-green-100 text-green-800"
                  : queueData.status === "CALLED"
                  ? "bg-yellow-100 text-yellow-800"
                  : queueData.status === "ARRIVED"
                  ? "bg-blue-100 text-blue-800"
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
          {/* Arrival Confirmation Button - Show when called */}
          {queueData.status === "CALLED" && (
            <Button
              onClick={handleConfirmArrival}
              variant="primary"
              fullWidth
              disabled={isConfirmingArrival}
            >
              {isConfirmingArrival ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Confirming...
                </>
              ) : (
                "✓ Confirm Arrival"
              )}
            </Button>
          )}

          <div className="flex gap-4">
            <Button
              onClick={() => router.push("/")}
              variant="secondary"
              fullWidth
            >
              Back to Shops
            </Button>
            <Button
              onClick={fetchQueuePosition}
              variant="primary"
              fullWidth
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Refreshing...
                </>
              ) : (
                "Refresh Status"
              )}
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
