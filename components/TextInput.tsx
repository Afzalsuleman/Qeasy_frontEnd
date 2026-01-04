"use client";

import React, { useState } from "react";

export interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
  type?: "text" | "email" | "tel" | "password";
}

export default function TextInput({
  value,
  onChange,
  onBlur,
  error,
  disabled = false,
  placeholder,
  label,
  type = "text",
}: TextInputProps) {
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
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      <div
        className={`
          relative flex items-center
          border-2 rounded-lg
          transition-all duration-200
          ${isFocused ? "border-blue-500" : "border-gray-300"}
          ${showError ? "border-red-500" : ""}
          ${disabled ? "bg-gray-100 cursor-not-allowed" : "bg-white"}
        `}
      >
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder}
          className={`
            w-full px-4 py-3
            text-lg
            outline-none
            bg-transparent
            ${disabled ? "cursor-not-allowed" : ""}
          `}
        />
      </div>
      
      {showError && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

