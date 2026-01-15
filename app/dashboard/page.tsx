"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import LoadingSpinner from "@/components/LoadingSpinner";
import Modal from "@/components/Modal";
import TextInput from "@/components/TextInput";
import ToastContainer from "@/components/ToastContainer";
import NotificationBell from "@/components/NotificationBell";
import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/services/constants";
import { useAuth } from "@/contexts/AuthContext";
import { handleApiError } from "@/services/errors";
import { wsService } from "@/services/websocket";

interface Shop {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  address: string;
  imageUrl?: string;
  phone?: string;
  avgServiceTimeMinutes: number;
  maxQueueSize: number;
  isActive: boolean;
  currentQueueSize: number;
  estimatedWaitTimeMinutes: number;
  createdAt: string;
  updatedAt: string;
}

interface ToastItem {
  id: string;
  message: string;
  type?: "success" | "error" | "info";
  duration?: number;
}

interface Notification {
  id: string;
  message: string;
  type: "joined" | "left" | "called";
  timestamp: Date;
  read: boolean;
}

export default function ShopOwnerDashboardPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, logout, user } = useAuth();

  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddShopModal, setShowAddShopModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isCallingNext, setIsCallingNext] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Shop form state
  const [shopName, setShopName] = useState("");
  const [shopDescription, setShopDescription] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [shopPhone, setShopPhone] = useState("");
  const [shopImageUrl, setShopImageUrl] = useState("");
  const [avgServiceTime, setAvgServiceTime] = useState("");
  const [maxQueueSize, setMaxQueueSize] = useState("");
  const [formErrors, setFormErrors] = useState<{
    name?: string;
    address?: string;
    avgServiceTime?: string;
    maxQueueSize?: string;
  }>({});

  // WebSocket connection for real-time queue updates
  const [isConnected, setIsConnected] = useState(false);

  // Connect/reconnect WebSocket when shop changes
  useEffect(() => {
    if (!selectedShop || !isAuthenticated) {
      if (wsService.isConnected()) {
        wsService.disconnect();
        setIsConnected(false);
      }
      return;
    }

    let unsubscribeQueueTopic: (() => void) | null = null;
    let unsubscribeCurrentTopic: (() => void) | null = null;

    // Connect to WebSocket (STOMP)
    const connectWebSocket = async () => {
      try {
        // Disconnect existing connection first
        if (wsService.isConnected()) {
          wsService.disconnect();
          setIsConnected(false);
        }

        // Wait a bit before reconnecting
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Connect to STOMP WebSocket
        await wsService.connect("");
        console.log("WebSocket connected via STOMP");
        
        // Wait a bit to ensure connection is fully established
        await new Promise((resolve) => setTimeout(resolve, 200));
        
        // Verify connection is active before subscribing
        if (!wsService.isConnected()) {
          console.error("WebSocket connection not active after connect");
          setIsConnected(false);
          return;
        }
        
        setIsConnected(true);

        const shopId = selectedShop.id;
        const queueTopic = `/topic/queue/${shopId}`;
        const currentTopic = `/topic/queue/${shopId}/current`;

        // Subscribe to main queue updates (individual events)
        unsubscribeQueueTopic = wsService.subscribe(queueTopic, (data: unknown) => {
          console.log("Queue update received:", data);
          
          const queueData = data as {
            status?: string;
            userName?: string;
            userId?: string;
            shopId?: string;
            shopName?: string;
            position?: number;
            peopleAhead?: number;
            totalInQueue?: number;
            estimatedWaitTimeMinutes?: number;
          };

          const status = queueData.status || "";
          const userName = queueData.userName || "";

          // Create notification based on status
          if (status === "JOINED" || status === "joined") {
            const notification: Notification = {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              message: `${userName || "A customer"} joined the queue`,
              type: "joined",
              timestamp: new Date(),
              read: false,
            };
            setNotifications((prev) => [notification, ...prev]);
          } else if (status === "LEFT" || status === "left") {
            const notification: Notification = {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              message: `${userName || "A customer"} left the queue`,
              type: "left",
              timestamp: new Date(),
              read: false,
            };
            setNotifications((prev) => [notification, ...prev]);
          } else if (status === "CALLED" || status === "called") {
            const notification: Notification = {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              message: `${userName || "A customer"} has been called`,
              type: "called",
              timestamp: new Date(),
              read: false,
            };
            setNotifications((prev) => [notification, ...prev]);
          }

          // Refresh shop data to get updated queue size
          refreshShopData();
        });

        // Subscribe to current queue statistics (aggregated stats)
        unsubscribeCurrentTopic = wsService.subscribe(currentTopic, (data: unknown) => {
          console.log("Current queue stats received:", data);
          
          const statsData = data as {
            shopId?: string;
            shopName?: string;
            currentQueueSize?: number;
            joinedCount?: number;
            calledCount?: number;
            estimatedWaitTimeMinutes?: number;
            maxQueueSize?: number;
            avgServiceTimeMinutes?: number;
          };

          // Update selected shop with new statistics
          if (statsData.shopId === selectedShop.id) {
            setSelectedShop((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                currentQueueSize: statsData.currentQueueSize ?? prev.currentQueueSize,
                estimatedWaitTimeMinutes: statsData.estimatedWaitTimeMinutes ?? prev.estimatedWaitTimeMinutes,
              };
            });

            // Also update in shops list
            setShops((prevShops) =>
              prevShops.map((shop) =>
                shop.id === statsData.shopId
                  ? {
                      ...shop,
                      currentQueueSize: statsData.currentQueueSize ?? shop.currentQueueSize,
                      estimatedWaitTimeMinutes: statsData.estimatedWaitTimeMinutes ?? shop.estimatedWaitTimeMinutes,
                    }
                  : shop
              )
            );
          }
        });
      } catch (err) {
        console.error("Failed to connect WebSocket:", err);
        setIsConnected(false);
      }
    };

    // Helper function to refresh shop data
    const refreshShopData = async () => {
      try {
        const response = await api.get<Shop[]>(
          API_ENDPOINTS.SHOP.LIST,
          true
        );
        const userShops = response.data.filter(
          (shop) => shop.ownerId === user?.id
        );
        setShops(userShops);
        
        const updatedShop = userShops.find((s) => s.id === selectedShop.id);
        if (updatedShop) {
          setSelectedShop(updatedShop);
        }
      } catch (err) {
        console.error("Error refreshing shops:", err);
      }
    };

    // Listen for connection events
    const handleConnectionEstablished = () => {
      setIsConnected(true);
    };

    const handleConnectionClosed = () => {
      setIsConnected(false);
    };

    wsService.on("CONNECTION_ESTABLISHED", handleConnectionEstablished);
    wsService.on("CONNECTION_CLOSED", handleConnectionClosed);

    // Connect when shop is selected
    connectWebSocket();

    return () => {
      // Unsubscribe from topics
      if (unsubscribeQueueTopic) {
        unsubscribeQueueTopic();
      }
      if (unsubscribeCurrentTopic) {
        unsubscribeCurrentTopic();
      }
      
      wsService.off("CONNECTION_ESTABLISHED", handleConnectionEstablished);
      wsService.off("CONNECTION_CLOSED", handleConnectionClosed);
    };
  }, [selectedShop?.id, isAuthenticated, user?.id]);

  // Redirect if not authenticated or not shop owner
  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || !user) {
      router.push("/admin/login");
      return;
    }

    if (user.role !== "shop_owner") {
      if (user.role === "admin") {
        router.push("/admin/dashboard");
      } else {
        router.push("/");
      }
      return;
    }
  }, [isAuthenticated, authLoading, user, router]);

  // Fetch shops owned by this shop owner
  useEffect(() => {
    const fetchShops = async () => {
      if (!isAuthenticated || user?.role !== "shop_owner") return;

      try {
        setIsLoading(true);
        setError("");

        const response = await api.get<Shop[]>(
          API_ENDPOINTS.SHOP.LIST,
          true // requires auth
        );

        const userShops = response.data.filter(
          (shop) => shop.ownerId === user?.id
        );
        setShops(userShops);

        if (userShops.length > 0 && !selectedShop) {
          setSelectedShop(userShops[0]);
        }
      } catch (err) {
        const errorMessage = handleApiError(err);
        setError(errorMessage);
        console.error("Error fetching shops:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchShops();
  }, [isAuthenticated, user]);


  const validateShopForm = (): boolean => {
    const errors: typeof formErrors = {};

    if (!shopName.trim()) {
      errors.name = "Shop name is required";
    }

    if (!shopAddress.trim()) {
      errors.address = "Address is required";
    }

    if (!avgServiceTime.trim()) {
      errors.avgServiceTime = "Average service time is required";
    } else if (isNaN(Number(avgServiceTime)) || Number(avgServiceTime) <= 0) {
      errors.avgServiceTime = "Must be a positive number";
    }

    if (!maxQueueSize.trim()) {
      errors.maxQueueSize = "Max queue size is required";
    } else if (isNaN(Number(maxQueueSize)) || Number(maxQueueSize) <= 0) {
      errors.maxQueueSize = "Must be a positive number";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateShop = async () => {
    if (!validateShopForm()) return;

    try {
      setIsCreating(true);
      setError("");

      const response = await api.post<Shop>(
        API_ENDPOINTS.SHOP.CREATE,
        {
          name: shopName,
          description: shopDescription || undefined,
          address: shopAddress,
          imageUrl: shopImageUrl || undefined,
          phone: shopPhone || undefined,
          avgServiceTimeMinutes: Number(avgServiceTime),
          maxQueueSize: Number(maxQueueSize),
        },
        true
      );

      // Add new shop to list
      setShops([...shops, response.data]);
      setSelectedShop(response.data);

      // Reset form and close modal
      setShopName("");
      setShopDescription("");
      setShopAddress("");
      setShopPhone("");
      setShopImageUrl("");
      setAvgServiceTime("");
      setMaxQueueSize("");
      setFormErrors({});
      setShowAddShopModal(false);

      // Show success toast
      const toastId = Date.now().toString();
      setToasts([
        ...toasts,
        {
          id: toastId,
          message: "Shop created successfully!",
          type: "success",
          duration: 3000,
        },
      ]);
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const handleShopSelect = (shop: Shop) => {
    setSelectedShop(shop);
  };

  const handleCallNext = async () => {
    if (!selectedShop) return;

    try {
      setIsCallingNext(true);
      setError("");

      await api.post(
        `${API_ENDPOINTS.QUEUE.CALL_NEXT}/${selectedShop.id}`,
        {},
        true // requires auth
      );

      // Show success toast
      const toastId = Date.now().toString();
      setToasts([
        ...toasts,
        {
          id: toastId,
          message: "Next customer has been called!",
          type: "success",
          duration: 3000,
        },
      ]);

      // Refresh shops list to get updated queue data
      const refreshShops = async () => {
        try {
          const response = await api.get<Shop[]>(
            API_ENDPOINTS.SHOP.LIST,
            true
          );
          const userShops = response.data.filter(
            (shop) => shop.ownerId === user?.id
          );
          setShops(userShops);
          
          const updatedShop = userShops.find((s) => s.id === selectedShop.id);
          if (updatedShop) {
            setSelectedShop(updatedShop);
          }
        } catch (err) {
          console.error("Error refreshing shops:", err);
        }
      };

      refreshShops();
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      
      // Show error toast
      const toastId = Date.now().toString();
      setToasts([
        ...toasts,
        {
          id: toastId,
          message: errorMessage,
          type: "error",
          duration: 5000,
        },
      ]);
    } finally {
      setIsCallingNext(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push("/admin/login");
  };

  const removeToast = (id: string) => {
    setToasts(toasts.filter((toast) => toast.id !== id));
  };

  const handleMarkNotificationAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
  };

  // Show loading while auth is initializing
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Redirect if not authenticated or not shop owner
  if (!isAuthenticated || user?.role !== "shop_owner") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Queue Management
              </h1>
              <p className="text-gray-600 mt-1 text-sm sm:text-base">
                Welcome, {user?.name || "Shop Owner"}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 w-full sm:w-auto">
              {/* Notification Bell */}
              {selectedShop && (
                <NotificationBell
                  notifications={notifications}
                  onMarkAsRead={handleMarkNotificationAsRead}
                  onClearAll={handleClearAllNotifications}
                />
              )}
              <Button
                onClick={() => router.push("/dashboard/analytics")}
                variant="secondary"
                className="sm:w-auto w-full"
              >
                📊 Analytics
              </Button>
              <Button
                onClick={() => setShowAddShopModal(true)}
                variant="primary"
                className="sm:w-auto w-full"
              >
                + Add Shop
              </Button>
              <Button
                onClick={handleLogout}
                variant="secondary"
                className="sm:w-auto w-full"
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Shops List */}
        {shops.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Your Shops
            </h2>
            <div className="flex flex-wrap gap-3">
              {shops.map((shop) => (
                <button
                  key={shop.id}
                  onClick={() => handleShopSelect(shop)}
                  className={`
                    px-4 py-2 rounded-lg border-2 transition-all
                    ${
                      selectedShop?.id === shop.id
                        ? "border-[#4f46e5] bg-[#4f46e5] bg-opacity-10 text-[#4f46e5] font-semibold"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                    }
                  `}
                >
                  {shop.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Queue Management Section */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : selectedShop ? (
          <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-200">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {selectedShop.name}
              </h2>
              {selectedShop.description && (
                <p className="text-gray-600 mb-4">{selectedShop.description}</p>
              )}
            </div>

            {/* Current Queue Status */}
            <div className="mb-8">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200 mb-6">
                <p className="text-sm text-blue-600 font-medium mb-2">Current Queue Status</p>
                <div className="flex items-baseline justify-center gap-2">
                  <p className="text-5xl font-bold text-blue-900">
                    {selectedShop.currentQueueSize}
                  </p>
                  <p className="text-lg text-blue-600">
                    / {selectedShop.maxQueueSize}
                  </p>
                </div>
                <p className="text-xs text-blue-600 mt-2 text-center">
                  {selectedShop.currentQueueSize === 0
                    ? "No customers in queue"
                    : `${selectedShop.currentQueueSize} customer${selectedShop.currentQueueSize > 1 ? "s" : ""} waiting`}
                </p>
              </div>

              {/* WebSocket Connection Status */}
              {isConnected && (
                <div className="flex items-center justify-center gap-2 text-sm text-green-600 mb-4">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Live updates active</span>
                </div>
              )}

              {/* Call Next Button */}
              <div className="flex justify-center">
                <Button
                  onClick={handleCallNext}
                  variant="primary"
                  className={`px-8 py-4 text-xl font-semibold shadow-lg ${
                    selectedShop.currentQueueSize === 0
                      ? "bg-gray-400 hover:bg-gray-400 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
                  disabled={isCallingNext || selectedShop.currentQueueSize === 0}
                >
                  {isCallingNext ? (
                    <span className="flex items-center">
                      <LoadingSpinner size="sm" className="mr-2" />
                      Calling Next Customer...
                    </span>
                  ) : (
                    <>
                      📞 Call Next Customer
                      {selectedShop.currentQueueSize > 0 && (
                        <span className="ml-2 text-sm opacity-90">
                          ({selectedShop.currentQueueSize} in queue)
                        </span>
                      )}
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Shop Info */}
            <div className="border-t border-gray-200 pt-6">
              <div className="flex flex-wrap gap-4 justify-center text-sm text-gray-500">
                <p className="flex items-center">
                  <span className="mr-2">📍</span>
                  {selectedShop.address}
                </p>
                {selectedShop.phone && (
                  <p className="flex items-center">
                    <span className="mr-2">📞</span>
                    {selectedShop.phone}
                  </p>
                )}
                <p className="flex items-center">
                  <span className="mr-2">⏱️</span>
                  Avg. Service: {selectedShop.avgServiceTimeMinutes} min
                </p>
              </div>
            </div>
          </div>
        ) : shops.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 border border-gray-200 text-center">
            <p className="text-gray-500 mb-4">You don't have any shops yet</p>
            <Button
              onClick={() => setShowAddShopModal(true)}
              variant="primary"
            >
              Create Your First Shop
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-12 border border-gray-200 text-center">
            <p className="text-gray-500">Please select a shop</p>
          </div>
        )}
      </main>

      {/* Add Shop Modal */}
      <Modal
        isOpen={showAddShopModal}
        onClose={() => {
          setShowAddShopModal(false);
          setShopName("");
          setShopDescription("");
          setShopAddress("");
          setShopPhone("");
          setShopImageUrl("");
          setAvgServiceTime("");
          setMaxQueueSize("");
          setFormErrors({});
          setError("");
        }}
        size="lg"
      >
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Add New Shop
            </h2>
            <p className="text-gray-600">Create a new shop for your business</p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <TextInput
              value={shopName}
              onChange={setShopName}
              label="Shop Name *"
              placeholder="Joe's Coffee Shop"
              error={formErrors.name}
              disabled={isCreating}
            />

            <TextInput
              value={shopDescription}
              onChange={setShopDescription}
              label="Description"
              placeholder="Best coffee in town!"
              disabled={isCreating}
            />

            <TextInput
              value={shopAddress}
              onChange={setShopAddress}
              label="Address *"
              placeholder="123 Main St, New York, NY 10001"
              error={formErrors.address}
              disabled={isCreating}
            />

            <TextInput
              value={shopPhone}
              onChange={setShopPhone}
              label="Phone Number"
              type="tel"
              placeholder="+1-555-0123"
              disabled={isCreating}
            />

            <TextInput
              value={shopImageUrl}
              onChange={setShopImageUrl}
              label="Image URL"
              placeholder="https://example.com/shop-image.jpg"
              disabled={isCreating}
            />

            <div className="grid grid-cols-2 gap-4">
              <TextInput
                value={avgServiceTime}
                onChange={setAvgServiceTime}
                label="Avg. Service Time (minutes) *"
                type="text"
                placeholder="10"
                error={formErrors.avgServiceTime}
                disabled={isCreating}
              />

              <TextInput
                value={maxQueueSize}
                onChange={setMaxQueueSize}
                label="Max Queue Size *"
                type="text"
                placeholder="50"
                error={formErrors.maxQueueSize}
                disabled={isCreating}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={() => {
                setShowAddShopModal(false);
                setShopName("");
                setShopDescription("");
                setShopAddress("");
                setShopPhone("");
                setShopImageUrl("");
                setAvgServiceTime("");
                setMaxQueueSize("");
                setFormErrors({});
                setError("");
              }}
              variant="secondary"
              fullWidth
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateShop}
              variant="primary"
              fullWidth
              isLoading={isCreating}
            >
              Create Shop
            </Button>
          </div>
        </div>
      </Modal>

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
