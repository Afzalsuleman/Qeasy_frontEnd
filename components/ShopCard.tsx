"use client";

import React from "react";
import Button from "./Button";

export interface ShopCardProps {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  queueLength: number;
  estimatedWaitTime: number; // in minutes
  imageUrl?: string;
  onJoinQueue: () => void;
}

export default function ShopCard({
  id,
  name,
  address,
  phone,
  queueLength,
  estimatedWaitTime,
  imageUrl,
  onJoinQueue,
}: ShopCardProps) {
  const handleJoinQueue = () => {
    onJoinQueue();
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-200">
      {imageUrl && (
        <div className="w-full h-48 bg-gray-200 overflow-hidden">
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      <div className="p-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">{name}</h3>
        
        {address && (
          <p className="text-gray-600 text-sm mb-1 flex items-center">
            <span className="mr-2">📍</span>
            {address}
          </p>
        )}
        
        {phone && (
          <p className="text-gray-600 text-sm mb-4 flex items-center">
            <span className="mr-2">📞</span>
            {phone}
          </p>
        )}

        <div className="flex items-center justify-between mb-4 pt-4 border-t border-gray-200">
          <div>
            <p className="text-xs text-gray-500 mb-1">Queue Length</p>
            <p className="text-lg font-semibold text-gray-900">{queueLength}</p>
          </div>
          
          <div className="text-right">
            <p className="text-xs text-gray-500 mb-1">Est. Wait Time</p>
            <p className="text-lg font-semibold text-blue-600">
              {estimatedWaitTime} min
            </p>
          </div>
        </div>

        <Button
          onClick={handleJoinQueue}
          variant="primary"
          fullWidth
          size="lg"
        >
          Join Queue
        </Button>
      </div>
    </div>
  );
}

