"use client";

import React, { useState } from "react";
import { isValidEmail } from "@/utils/helpers";

export interface EmailInputProps {
  value: string;
  onChange: (email: string) => void;
  onBlur?: () => void;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
}

export default function EmailInput({
  value,
  onChange,
  onBlur,
  error,
  disabled = false,
  placeholder = "Enter your email",
}: EmailInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const handleBlur = () => {
    setIsFocused(false);
    setHasInteracted(true);
    onBlur?.();
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const showError = hasInteracted && error;

  return (
    <div className="w-full">
      <div
          className={`
          relative flex items-center
          border rounded-lg
          transition-all duration-200
          ${isFocused ? "border-[#4f46e5] shadow-sm" : "border-gray-200"}
          ${showError ? "border-red-400" : ""}
          ${disabled ? "bg-gray-100 cursor-not-allowed" : "bg-white"}
        `}
      >
        <input
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder}
          className={`
            w-full px-4 py-3
            text-lg
            text-gray-900
            placeholder:text-gray-400
            outline-none
            bg-transparent
            ${disabled ? "cursor-not-allowed opacity-60" : ""}
          `}
        />
      </div>
      
      {showError && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

