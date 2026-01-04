/**
 * Environment configuration
 * Centralized configuration for API URLs and other environment variables
 */

export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080",
  wsUrl: process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080",
  environment: process.env.NODE_ENV || "development",
} as const;

export const isDevelopment = config.environment === "development";
export const isProduction = config.environment === "production";

