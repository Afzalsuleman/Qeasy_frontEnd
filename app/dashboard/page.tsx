"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import LoadingSpinner from "@/components/LoadingSpinner";
import Modal from "@/components/Modal";
import TextInput from "@/components/TextInput";
import ToastContainer from "@/components/ToastContainer";
import AnalyticsChart from "@/components/AnalyticsChart";
import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/services/constants";
import { useAuth } from "@/contexts/AuthContext";
import { handleApiError } from "@/services/errors";

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

interface AnalyticsData {
  shopId: string;
  shopName: string;
  totalCustomers?: number;
  totalVisitors?: number;
  averageWaitTime?: number | null;
  averageWaitTimeMinutes?: number | null;
  currentQueueSize: number;
  servedToday?: number;
  servedCount?: number;
  noShowCount?: number;
  estimatedWaitTimeMinutes?: number | null;
  completionRate?: number | null;
  noShowRate?: number | null;
  maxQueueSize?: number | null;
  avgServiceTimeMinutes?: number | null;
  analyzedDays?: number;
  startDate?: string;
  endDate?: string;
  [key: string]: unknown;
}

interface ToastItem {
  id: string;
  message: string;
  type?: "success" | "error" | "info";
  duration?: number;
}

export default function ShopOwnerDashboardPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, logout, user } = useAuth();

  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [error, setError] = useState("");
  const [showAddShopModal, setShowAddShopModal] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isCallingNext, setIsCallingNext] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

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

  // Redirect if not authenticated or not shop owner
  useEffect(() => {
    // Wait for auth to finish loading before checking
    if (authLoading) return;

    if (!isAuthenticated) {
      router.push("/admin/login");
      return;
    }

    if (user?.role !== "shop_owner") {
      if (user?.role === "admin") {
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

        // Filter shops owned by this user
        const userShops = response.data.filter(
          (shop) => shop.ownerId === user?.id
        );
        setShops(userShops);

        // If there's at least one shop, select the first one
        // Analytics will be fetched automatically via the selectedShop useEffect
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

  // Fetch analytics when selected shop changes
  useEffect(() => {
    if (!selectedShop || !isAuthenticated || user?.role !== "shop_owner") {
      return;
    }

    // Abort any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const fetchShopAnalytics = async (shopId: string) => {
      try {
        setIsLoadingAnalytics(true);
        setError("");

        // Fetch both 7-day analytics and today's analytics
        const [weeklyResponse, todayResponse] = await Promise.all([
          api.get<AnalyticsData>(
            `${API_ENDPOINTS.ANALYTICS.SHOP}/${shopId}?days=7`,
            true
          ),
          api.get<AnalyticsData>(
            `${API_ENDPOINTS.ANALYTICS.SHOP_TODAY}/${shopId}/today`,
            true
          ),
        ]);

        // Check if request was aborted
        if (abortController.signal.aborted) {
          return;
        }

        // Merge today's data with weekly data (today's data takes precedence)
        // Today's analytics come from: GET /api/v1/analytics/shop/${shopId}/today
        // Weekly analytics come from: GET /api/v1/analytics/shop/${shopId}?days=7
        console.log("Today's Analytics API Response:", todayResponse.data);
        console.log("Weekly Analytics API Response:", weeklyResponse.data);
        
        const mergedAnalytics = {
          ...weeklyResponse.data,
          ...todayResponse.data, // Today's data overrides weekly data
        };
        
        console.log("Merged Analytics (used for display):", mergedAnalytics);
        console.log("Served Count from today API:", todayResponse.data.servedCount);
        console.log("Served Today from today API:", todayResponse.data.servedToday);
        
        setAnalytics(mergedAnalytics);
      } catch (err) {
        // Don't set error if request was aborted
        if (abortController.signal.aborted) {
          return;
        }
        const errorMessage = handleApiError(err);
        setError(errorMessage);
        console.error("Error fetching analytics:", err);
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoadingAnalytics(false);
        }
      }
    };

    fetchShopAnalytics(selectedShop.id);

    // Cleanup function
    return () => {
      abortController.abort();
    };
  }, [selectedShop, isAuthenticated, user]);

  // Fetch analytics function (for manual calls like when shop is created)
  const fetchShopAnalytics = async (shopId: string) => {
    try {
      setIsLoadingAnalytics(true);
      setError("");

      // Fetch both 7-day analytics and today's analytics
      const [weeklyResponse, todayResponse] = await Promise.all([
        api.get<AnalyticsData>(
          `${API_ENDPOINTS.ANALYTICS.SHOP}/${shopId}?days=7`,
          true
        ),
        api.get<AnalyticsData>(
          `${API_ENDPOINTS.ANALYTICS.SHOP_TODAY}/${shopId}/today`,
          true
        ),
      ]);

      // Merge today's data with weekly data (today's data takes precedence)
      setAnalytics({
        ...weeklyResponse.data,
        ...todayResponse.data,
      });
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      console.error("Error fetching analytics:", err);
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

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
      // Analytics will be fetched automatically via the selectedShop useEffect

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
    // Analytics will be fetched automatically via the selectedShop useEffect
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

      // Refresh shops list and analytics to get updated queue data
      if (selectedShop) {
        // Refresh shops list to get updated queue sizes
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
            
            // Update selected shop with latest data
            const updatedShop = userShops.find((s) => s.id === selectedShop.id);
            if (updatedShop) {
              setSelectedShop(updatedShop);
            }
          } catch (err) {
            console.error("Error refreshing shops:", err);
          }
        };

        // Refresh analytics
        const fetchShopAnalytics = async (shopId: string) => {
          try {
            setIsLoadingAnalytics(true);

            const [weeklyResponse, todayResponse] = await Promise.all([
              api.get<AnalyticsData>(
                `${API_ENDPOINTS.ANALYTICS.SHOP}/${shopId}?days=7`,
                true
              ),
              api.get<AnalyticsData>(
                `${API_ENDPOINTS.ANALYTICS.SHOP_TODAY}/${shopId}/today`,
                true
              ),
            ]);

            const updatedAnalytics = {
              ...weeklyResponse.data,
              ...todayResponse.data,
            };
            setAnalytics(updatedAnalytics);

            return updatedAnalytics;
          } catch (err) {
            console.error("Error refreshing analytics:", err);
            return null;
          } finally {
            setIsLoadingAnalytics(false);
          }
        };

        // Refresh both in parallel
        const [shopsResult, analyticsResult] = await Promise.all([
          refreshShops(),
          fetchShopAnalytics(selectedShop.id),
        ]);

        // Update selectedShop's currentQueueSize from analytics if available
        if (analyticsResult?.currentQueueSize !== undefined) {
          setSelectedShop((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              currentQueueSize: analyticsResult.currentQueueSize,
            };
          });
        }
      }
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
                Analytics Dashboard
              </h1>
              <p className="text-gray-600 mt-1 text-sm sm:text-base">
                Welcome, {user?.name || "Shop Owner"}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
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

        {/* Analytics Cards */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : selectedShop && analytics ? (
          <>
            {/* Call Next Button Section */}
            <div className="mb-6 flex justify-center">
              <Button
                onClick={handleCallNext}
                variant="primary"
                className={`px-8 py-3 text-lg font-semibold shadow-lg ${
                  (analytics?.currentQueueSize || selectedShop?.currentQueueSize || 0) === 0
                    ? "bg-gray-400 hover:bg-gray-400 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700"
                }`}
                disabled={
                  isCallingNext ||
                  (analytics?.currentQueueSize || selectedShop?.currentQueueSize || 0) === 0
                }
              >
                {isCallingNext ? (
                  <span className="flex items-center">
                    <LoadingSpinner size="sm" className="mr-2" />
                    Calling Next Customer...
                  </span>
                ) : (
                  <>
                    📞 Call Next Customer
                    {(analytics?.currentQueueSize || selectedShop?.currentQueueSize) ? (
                      <span className="ml-2 text-sm opacity-90">
                        ({analytics?.currentQueueSize || selectedShop?.currentQueueSize} in queue)
                      </span>
                    ) : null}
                  </>
                )}
              </Button>
            </div>

            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-sm p-6 border border-blue-200">
                <p className="text-sm text-blue-600 font-medium mb-1">Current Queue</p>
                <p className="text-4xl font-bold text-blue-900">
                  {analytics.currentQueueSize || selectedShop.currentQueueSize}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Max: {analytics.maxQueueSize != null
                    ? analytics.maxQueueSize
                    : selectedShop.maxQueueSize != null
                    ? selectedShop.maxQueueSize
                    : "N/A"}
                </p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl shadow-sm p-6 border border-purple-200">
                <p className="text-sm text-purple-600 font-medium mb-1">Total Visitors</p>
                <p className="text-4xl font-bold text-purple-900">
                  {analytics.totalVisitors || analytics.totalCustomers || 0}
                </p>
                <p className="text-xs text-purple-600 mt-1">Last 7 days</p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-sm p-6 border border-green-200">
                <p className="text-sm text-green-600 font-medium mb-1">Served Today</p>
                <p className="text-4xl font-bold text-green-900">
                  {analytics.servedCount || analytics.servedToday || 0}
                </p>
                {analytics.completionRate != null && (
                  <p className="text-xs text-green-600 mt-1">
                    {analytics.completionRate.toFixed(1)}% completion rate
                  </p>
                )}
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl shadow-sm p-6 border border-orange-200">
                <p className="text-sm text-orange-600 font-medium mb-1">Avg. Wait Time</p>
                <p className="text-4xl font-bold text-orange-900">
                  {analytics.averageWaitTimeMinutes != null
                    ? `${analytics.averageWaitTimeMinutes} min`
                    : analytics.averageWaitTime != null
                    ? `${analytics.averageWaitTime} min`
                    : selectedShop.estimatedWaitTimeMinutes != null
                    ? `${selectedShop.estimatedWaitTimeMinutes} min`
                    : "N/A"}
                </p>
                {analytics.estimatedWaitTimeMinutes != null && (
                  <p className="text-xs text-orange-600 mt-1">
                    Est: {analytics.estimatedWaitTimeMinutes} min
                  </p>
                )}
              </div>
            </div>

            {/* Additional Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <p className="text-sm text-gray-500 mb-1">No Shows</p>
                <p className="text-3xl font-bold text-red-600">
                  {analytics.noShowCount || 0}
                </p>
                {analytics.noShowRate != null && (
                  <p className="text-xs text-gray-500 mt-1">
                    {analytics.noShowRate.toFixed(1)}% no-show rate
                  </p>
                )}
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <p className="text-sm text-gray-500 mb-1">Avg. Service Time</p>
                <p className="text-3xl font-bold text-indigo-600">
                  {analytics.avgServiceTimeMinutes != null
                    ? `${analytics.avgServiceTimeMinutes} min`
                    : selectedShop.avgServiceTimeMinutes != null
                    ? `${selectedShop.avgServiceTimeMinutes} min`
                    : "N/A"}
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <p className="text-sm text-gray-500 mb-1">Queue Utilization</p>
                <p className="text-3xl font-bold text-gray-900">
                  {analytics.maxQueueSize != null && analytics.maxQueueSize > 0
                    ? Math.round(
                        ((analytics.currentQueueSize || 0) / analytics.maxQueueSize) * 100
                      )
                    : selectedShop.maxQueueSize != null && selectedShop.maxQueueSize > 0
                    ? Math.round(
                        ((analytics.currentQueueSize || 0) / selectedShop.maxQueueSize) * 100
                      )
                    : 0}
                  %
                </p>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-[#4f46e5] h-2 rounded-full transition-all"
                    style={{
                      width: `${
                        analytics.maxQueueSize != null && analytics.maxQueueSize > 0
                          ? Math.min(
                              ((analytics.currentQueueSize || 0) / analytics.maxQueueSize) * 100,
                              100
                            )
                          : selectedShop.maxQueueSize != null && selectedShop.maxQueueSize > 0
                          ? Math.min(
                              ((analytics.currentQueueSize || 0) / selectedShop.maxQueueSize) * 100,
                              100
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Service Performance Chart */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Service Performance
                </h3>
                {(() => {
                  const served = analytics.servedCount || analytics.servedToday || 0;
                  const noShow = analytics.noShowCount || 0;
                  const inQueue = analytics.currentQueueSize || 0;
                  const total = served + noShow + inQueue;

                  if (total === 0) {
                    return (
                      <div className="flex items-center justify-center h-[300px]">
                        <p className="text-gray-500">No data available yet</p>
                      </div>
                    );
                  }

                  return (
                    <AnalyticsChart
                      data={[
                        {
                          name: "Served",
                          value: served,
                          color: "#10b981",
                        },
                        {
                          name: "No Show",
                          value: noShow,
                          color: "#ef4444",
                        },
                        {
                          name: "In Queue",
                          value: inQueue,
                          color: "#4f46e5",
                        },
                      ]}
                      type="pie"
                      dataKey="value"
                      nameKey="name"
                    />
                  );
                })()}
              </div>

              {/* Queue Status Chart */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Queue Status
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Current Queue</span>
                      <span className="font-semibold text-gray-900">
                        {analytics.currentQueueSize || 0} / {analytics.maxQueueSize != null
                          ? analytics.maxQueueSize
                          : selectedShop.maxQueueSize != null
                          ? selectedShop.maxQueueSize
                          : "N/A"}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <div
                        className="bg-[#4f46e5] h-4 rounded-full transition-all"
                        style={{
                          width: `${
                            analytics.maxQueueSize != null && analytics.maxQueueSize > 0
                              ? Math.min(
                                  ((analytics.currentQueueSize || 0) / analytics.maxQueueSize) * 100,
                                  100
                                )
                              : selectedShop.maxQueueSize != null && selectedShop.maxQueueSize > 0
                              ? Math.min(
                                  ((analytics.currentQueueSize || 0) / selectedShop.maxQueueSize) * 100,
                                  100
                                )
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Completion Rate</span>
                      <span className="text-2xl font-bold text-green-600">
                        {analytics.completionRate
                          ? `${analytics.completionRate.toFixed(1)}%`
                          : "N/A"}
                      </span>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">No-Show Rate</span>
                      <span className="text-2xl font-bold text-red-600">
                        {analytics.noShowRate != null
                          ? `${analytics.noShowRate.toFixed(1)}%`
                          : "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Shop Info */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                {selectedShop.name}
              </h2>
              {selectedShop.description && (
                <p className="text-gray-600 mb-2">{selectedShop.description}</p>
              )}
              <div className="flex flex-wrap gap-4 mt-4">
                <p className="text-sm text-gray-500 flex items-center">
                  <span className="mr-2">📍</span>
                  {selectedShop.address}
                </p>
                {selectedShop.phone && (
                  <p className="text-sm text-gray-500 flex items-center">
                    <span className="mr-2">📞</span>
                    {selectedShop.phone}
                  </p>
                )}
              </div>
            </div>
          </>
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
            {isLoadingAnalytics ? (
              <LoadingSpinner size="lg" />
            ) : (
              <p className="text-gray-500">No analytics data available</p>
            )}
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
