"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import LoadingSpinner from "@/components/LoadingSpinner";
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

export default function AnalyticsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, logout, user } = useAuth();

  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [error, setError] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const [timePeriod, setTimePeriod] = useState<"today" | "7days" | "30days" | "quarter">("today");

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

  // Fetch analytics when selected shop or time period changes
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

        let analyticsResponse: { data: AnalyticsData };

        if (timePeriod === "today") {
          analyticsResponse = await api.get<AnalyticsData>(
            `${API_ENDPOINTS.ANALYTICS.SHOP_TODAY}/${shopId}/today`,
            true
          );
        } else {
          let days = 7;
          if (timePeriod === "30days") {
            days = 30;
          } else if (timePeriod === "quarter") {
            days = 90;
          }

          analyticsResponse = await api.get<AnalyticsData>(
            `${API_ENDPOINTS.ANALYTICS.SHOP}/${shopId}?days=${days}`,
            true
          );
        }

        if (abortController.signal.aborted) {
          return;
        }

        setAnalytics(analyticsResponse.data);
      } catch (err) {
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

    return () => {
      abortController.abort();
    };
  }, [selectedShop, timePeriod, isAuthenticated, user]);

  const handleShopSelect = (shop: Shop) => {
    setSelectedShop(shop);
  };

  const handleLogout = async () => {
    await logout();
    router.push("/admin/login");
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
                onClick={() => router.push("/dashboard")}
                variant="secondary"
                className="sm:w-auto w-full"
              >
                Queue Management
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

        {/* Analytics Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : selectedShop && analytics ? (
          <>
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
                <p className="text-xs text-purple-600 mt-1">
                  {timePeriod === "today" 
                    ? "Today" 
                    : timePeriod === "7days" 
                    ? "Last 7 days" 
                    : timePeriod === "30days" 
                    ? "Last 30 days" 
                    : "Last quarter"}
                </p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-sm p-6 border border-green-200">
                <p className="text-sm text-green-600 font-medium mb-1">
                  {timePeriod === "today" ? "Served Today" : "Served"}
                </p>
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

            {/* Time Period Selector */}
            <div className="mb-6 flex flex-wrap gap-2 justify-center">
              <button
                onClick={() => setTimePeriod("today")}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  timePeriod === "today"
                    ? "bg-[#4f46e5] text-white shadow-md"
                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setTimePeriod("7days")}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  timePeriod === "7days"
                    ? "bg-[#4f46e5] text-white shadow-md"
                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                }`}
              >
                7 Days
              </button>
              <button
                onClick={() => setTimePeriod("30days")}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  timePeriod === "30days"
                    ? "bg-[#4f46e5] text-white shadow-md"
                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                }`}
              >
                30 Days
              </button>
              <button
                onClick={() => setTimePeriod("quarter")}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  timePeriod === "quarter"
                    ? "bg-[#4f46e5] text-white shadow-md"
                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                }`}
              >
                Quarter
              </button>
            </div>

            {/* Charts Section - Bar Graphs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Key Metrics Bar Chart */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Key Metrics
                </h3>
                {(() => {
                  const visitors = analytics.totalVisitors || analytics.totalCustomers || 0;
                  const served = analytics.servedCount || analytics.servedToday || 0;
                  const noShow = analytics.noShowCount || 0;
                  const inQueue = analytics.currentQueueSize || 0;

                  if (visitors === 0 && served === 0 && noShow === 0 && inQueue === 0) {
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
                          name: "Visitors",
                          value: visitors,
                          color: "#3b82f6",
                        },
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
                      type="bar"
                      dataKey="value"
                      nameKey="name"
                    />
                  );
                })()}
              </div>

              {/* Performance Metrics Bar Chart */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Performance Metrics
                </h3>
                {(() => {
                  const completionRate = analytics.completionRate || 0;
                  const noShowRate = analytics.noShowRate || 0;
                  const avgWaitTime = analytics.averageWaitTimeMinutes || analytics.averageWaitTime || 0;
                  const avgServiceTime = analytics.avgServiceTimeMinutes || selectedShop.avgServiceTimeMinutes || 0;

                  if (completionRate === 0 && noShowRate === 0 && avgWaitTime === 0 && avgServiceTime === 0) {
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
                          name: "Completion %",
                          value: completionRate,
                          color: "#10b981",
                        },
                        {
                          name: "No-Show %",
                          value: noShowRate,
                          color: "#ef4444",
                        },
                        {
                          name: "Avg Wait (min)",
                          value: avgWaitTime,
                          color: "#f59e0b",
                        },
                        {
                          name: "Avg Service (min)",
                          value: avgServiceTime,
                          color: "#8b5cf6",
                        },
                      ]}
                      type="bar"
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
              onClick={() => router.push("/dashboard")}
              variant="primary"
            >
              Go to Dashboard
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
    </div>
  );
}
