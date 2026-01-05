"use client";

import React, { useState, useEffect } from "react";
import ShopCard from "@/components/ShopCard";
import JoinQueueModal from "@/components/JoinQueueModal";
import LoadingSpinner from "@/components/LoadingSpinner";
import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/services/constants";
import { handleApiError } from "@/services/errors";

// API Shop Response Interface
interface ShopApiResponse {
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

// Shop data for components
interface ShopData {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  queueLength: number;
  estimatedWaitTime: number;
  imageUrl?: string;
  description?: string;
}

export default function Home() {
  const [shops, setShops] = useState<ShopData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedShop, setSelectedShop] = useState<ShopData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch shops from API
  useEffect(() => {
    const fetchShops = async () => {
      try {
        setIsLoading(true);
        setError("");
        const response = await api.get<ShopApiResponse[]>(
          API_ENDPOINTS.SHOP.LIST,
          false
        );

        // Map API response to ShopData format
        const mappedShops: ShopData[] = response.data
          .filter((shop) => shop.isActive) // Only show active shops
          .map((shop) => ({
            id: shop.id,
            name: shop.name,
            address: shop.address,
            phone: undefined, // API doesn't provide phone
            queueLength: shop.currentQueueSize,
            estimatedWaitTime: shop.estimatedWaitTimeMinutes,
            imageUrl: undefined, // API doesn't provide image
            description: shop.description,
          }));

        setShops(mappedShops);
      } catch (err) {
        const errorMessage = handleApiError(err);
        setError(errorMessage);
        console.error("Error fetching shops:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchShops();
  }, []);

  const handleJoinQueue = (shop: ShopData) => {
    setSelectedShop(shop);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    // Reset selected shop after a delay to allow modal close animation
    setTimeout(() => setSelectedShop(null), 300);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-4xl font-bold text-gray-900">Smart Queue</h1>
          <p className="text-gray-600 mt-2">Find and join queues at your favorite shops</p>
        </div>
      </header>

      {/* Shop List */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-900">Available Shops</h2>
          <p className="text-gray-600 mt-1">Select a shop to join its queue</p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <LoadingSpinner size="lg" />
              <p className="mt-4 text-gray-600">Loading shops...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-red-600 hover:text-red-700 text-sm font-medium"
            >
              Try again
            </button>
          </div>
        )}

        {/* Shops Grid */}
        {!isLoading && !error && (
          <>
            {shops.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {shops.map((shop) => (
                  <ShopCard
                    key={shop.id}
                    id={shop.id}
                    name={shop.name}
                    address={shop.address}
                    phone={shop.phone}
                    queueLength={shop.queueLength}
                    estimatedWaitTime={shop.estimatedWaitTime}
                    imageUrl={shop.imageUrl}
                    onJoinQueue={() => handleJoinQueue(shop)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No shops available at the moment</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Join Queue Modal */}
      {selectedShop && (
        <JoinQueueModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          shopData={{
            id: selectedShop.id,
            name: selectedShop.name,
            address: selectedShop.address,
            phone: selectedShop.phone,
            queueLength: selectedShop.queueLength,
            estimatedWaitTime: selectedShop.estimatedWaitTime,
          }}
        />
      )}
    </div>
  );
}
