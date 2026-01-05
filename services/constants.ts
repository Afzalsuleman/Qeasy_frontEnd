/**
 * Application constants
 */

// API Endpoints
export const API_ENDPOINTS = {
  // Auth endpoints
  AUTH: {
    LOGIN: "/api/v1/auth/login",
    LOGOUT: "/api/v1/auth/logout",
    VERIFY_OTP: "/api/v1/auth/verify-otp",
    GENERATE_OTP: "/api/v1/auth/generate-otp",
    SEND_OTP: "/api/v1/auth/generate-otp", // Alias for backward compatibility
  },
  // Queue endpoints
  QUEUE: {
    JOIN: "/api/v1/queue/join",
    POSITION: "/api/v1/queue/position",
    LEAVE: "/api/v1/queue/leave",
    STATUS: "/queue/status",
    CONFIRM_ARRIVAL: "/queue/confirm-arrival",
    CANCEL: "/queue/cancel",
  },
  // Shop endpoints
  SHOP: {
    LIST: "/api/v1/shops",
    INFO: "/shop/info",
    DASHBOARD: "/shop/dashboard",
    CALL_NEXT: "/shop/call-next",
    SKIP: "/shop/skip",
    MARK_SERVED: "/shop/mark-served",
    ADD_WALKIN: "/shop/add-walkin",
    STATS: "/shop/stats",
  },
} as const;

// WebSocket Events
export const WS_EVENTS = {
  QUEUE_JOINED: "QUEUE_JOINED",
  QUEUE_UPDATED: "QUEUE_UPDATED",
  TOKEN_CALLED: "TOKEN_CALLED",
  CONNECTION_ESTABLISHED: "CONNECTION_ESTABLISHED",
  CONNECTION_ERROR: "CONNECTION_ERROR",
  CONNECTION_CLOSED: "CONNECTION_CLOSED",
} as const;

// Local Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: "auth_token",
  USER_DATA: "user_data",
  QUEUE_TOKEN: "queue_token",
  SHOP_ID: "shop_id",
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: "Network error. Please check your connection.",
  UNAUTHORIZED: "Unauthorized. Please login again.",
  NOT_FOUND: "Resource not found.",
  SERVER_ERROR: "Server error. Please try again later.",
  INVALID_OTP: "Invalid OTP. Please try again.",
  QUEUE_FULL: "Queue is full. Please try again later.",
  GENERIC_ERROR: "Something went wrong. Please try again.",
} as const;

// Queue Status
export const QUEUE_STATUS = {
  WAITING: "waiting",
  CALLED: "called",
  SERVED: "served",
  CANCELLED: "cancelled",
} as const;

