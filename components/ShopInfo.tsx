"use client";

import React from "react";

export interface ShopInfoProps {
  shopName: string;
  queueLength: number;
  estimatedWaitTime: number; // in minutes
  shopAddress?: string;
  shopPhone?: string;
}

export default function ShopInfo({
  shopName,
  queueLength,
  estimatedWaitTime,
  shopAddress,
  shopPhone,
}: ShopInfoProps) {
  return (
    <div className="w-full bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">{shopName}</h1>
      
      {shopAddress && (
        <p className="text-gray-600 mb-2 text-sm">
          📍 {shopAddress}
        </p>
      )}
      
      {shopPhone && (
        <p className="text-gray-600 mb-4 text-sm">
          📞 {shopPhone}
        </p>
      )}

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
        <div className="flex-1">
          <p className="text-sm text-gray-500 mb-1">Queue Length</p>
          <p className="text-2xl font-bold text-gray-900">{queueLength}</p>
        </div>
        
        <div className="flex-1 text-right">
          <p className="text-sm text-gray-500 mb-1">Est. Wait Time</p>
          <p className="text-2xl font-bold text-[#4f46e5]">
            {estimatedWaitTime} min
          </p>
        </div>
      </div>
    </div>
  );
}

