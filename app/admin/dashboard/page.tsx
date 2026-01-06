"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import LoadingSpinner from "@/components/LoadingSpinner";
import Modal from "@/components/Modal";
import TextInput from "@/components/TextInput";
import ToastContainer from "@/components/ToastContainer";
import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/services/constants";
import { storage } from "@/services/storage";
import { useAuth } from "@/contexts/AuthContext";
import { handleApiError } from "@/services/errors";

interface ToastItem {
  id: string;
  message: string;
  type?: "success" | "error" | "info";
  duration?: number;
}

interface Shop {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  address: string;
  avgServiceTimeMinutes: number;
  maxQueueSize: number;
  isActive: boolean;
  currentQueueSize: number;
  estimatedWaitTimeMinutes: number;
  createdAt: string;
  updatedAt: string;
}

interface ShopOwner {
  email: string;
  name: string;
  phone: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, logout } = useAuth();

  const [shops, setShops] = useState<Shop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Shop owner form state
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [formErrors, setFormErrors] = useState<{
    email?: string;
    name?: string;
    phone?: string;
  }>({});

  // Redirect if not authenticated or not admin
  useEffect(() => {
    // Wait for auth to finish loading before checking
    if (authLoading) return;

    if (!isAuthenticated) {
      router.push("/admin/login");
      return;
    }

    // Check if user is admin
    const userData = storage.getUserData<{ role?: string }>();
    if (userData?.role !== "admin") {
      // If shop owner, redirect to shop owner dashboard
      if (userData?.role === "shop_owner") {
        router.push("/dashboard");
      } else {
        router.push("/");
      }
    }
  }, [isAuthenticated, authLoading, router]);

  // Fetch all shops
  useEffect(() => {
    const fetchShops = async () => {
      if (!isAuthenticated || authLoading) return;

      try {
        setIsLoading(true);
        setError("");

        const response = await api.get<Shop[]>(
          API_ENDPOINTS.SHOP.LIST,
          true // requires auth
        );

        setShops(response.data);
      } catch (err) {
        const errorMessage = handleApiError(err);
        setError(errorMessage);
        console.error("Error fetching shops:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchShops();
  }, [isAuthenticated, authLoading]);

  const validateOwnerForm = (): boolean => {
    const errors: typeof formErrors = {};

    if (!ownerEmail.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
      errors.email = "Invalid email format";
    }

    if (!ownerName.trim()) {
      errors.name = "Name is required";
    }

    if (!ownerPhone.trim()) {
      errors.phone = "Phone number is required";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOnboardOwner = async () => {
    if (!validateOwnerForm()) return;

    try {
      setIsOnboarding(true);
      setError("");

      await api.post(
        API_ENDPOINTS.ADMIN.ONBOARD_SHOP_OWNER,
        {
          email: ownerEmail,
          name: ownerName,
          phone: ownerPhone,
        },
        true
      );

      // Reset form and close modal
      setOwnerEmail("");
      setOwnerName("");
      setOwnerPhone("");
      setFormErrors({});
      setShowOnboardModal(false);

      // Show success toast
      const toastId = Date.now().toString();
      setToasts([
        ...toasts,
        {
          id: toastId,
          message: "Onboard mail sent successfully!",
          type: "success",
          duration: 3000,
        },
      ]);

      // Refresh shops list
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
    } finally {
      setIsOnboarding(false);
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

  // Redirect if not authenticated
  if (!isAuthenticated) {
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
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600 mt-1 text-sm sm:text-base">Manage shops and shop owners</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
              <Button
                onClick={() => setShowOnboardModal(true)}
                variant="primary"
                fullWidth={true}
                className="sm:w-auto"
              >
                + Onboard Shop Owner
              </Button>
              <Button 
                onClick={handleLogout} 
                variant="secondary"
                fullWidth={true}
                className="sm:w-auto"
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <p className="text-sm text-gray-500 mb-1">Total Shops</p>
            <p className="text-3xl font-bold text-gray-900">{shops.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <p className="text-sm text-gray-500 mb-1">Active Shops</p>
            <p className="text-3xl font-bold text-green-600">
              {shops.filter((s) => s.isActive).length}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <p className="text-sm text-gray-500 mb-1">Total in Queues</p>
            <p className="text-3xl font-bold text-[#4f46e5]">
              {shops.reduce((sum, s) => sum + s.currentQueueSize, 0)}
            </p>
          </div>
        </div>

        {/* Shops Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Shop Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Queue Size
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {shops.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        No shops found
                      </td>
                    </tr>
                  ) : (
                    shops.map((shop) => (
                      <tr key={shop.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {shop.name}
                          </div>
                          {shop.description && (
                            <div className="text-sm text-gray-500">
                              {shop.description}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{shop.address}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {shop.currentQueueSize} / {shop.maxQueueSize}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              shop.isActive
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {shop.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(shop.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Onboard Shop Owner Modal */}
      <Modal
        isOpen={showOnboardModal}
        onClose={() => {
          setShowOnboardModal(false);
          setOwnerEmail("");
          setOwnerName("");
          setOwnerPhone("");
          setFormErrors({});
          setError("");
        }}
        size="md"
      >
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Onboard Shop Owner
            </h2>
            <p className="text-gray-600">
              Create a new shop owner account
            </p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <TextInput
              value={ownerName}
              onChange={setOwnerName}
              label="Owner Name"
              placeholder="John Doe"
              error={formErrors.name}
              disabled={isOnboarding}
            />

            <TextInput
              value={ownerEmail}
              onChange={setOwnerEmail}
              label="Email"
              type="email"
              placeholder="owner@example.com"
              error={formErrors.email}
              disabled={isOnboarding}
            />

            <TextInput
              value={ownerPhone}
              onChange={setOwnerPhone}
              label="Phone Number"
              type="tel"
              placeholder="+91-828946736"
              error={formErrors.phone}
              disabled={isOnboarding}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={() => {
                setShowOnboardModal(false);
                setOwnerEmail("");
                setOwnerName("");
                setOwnerPhone("");
                setFormErrors({});
                setError("");
              }}
              variant="secondary"
              fullWidth
              disabled={isOnboarding}
            >
              Cancel
            </Button>
            <Button
              onClick={handleOnboardOwner}
              variant="primary"
              fullWidth
              isLoading={isOnboarding}
            >
              Create Account
            </Button>
          </div>
        </div>
      </Modal>

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

