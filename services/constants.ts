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
    CHANGE_PASSWORD: "/api/v1/auth/change-password",
  },
  // Queue endpoints
  QUEUE: {
    JOIN: "/api/v1/queue/join",
    POSITION: "/api/v1/queue/position",
    LEAVE: "/api/v1/queue/leave",
    CALL_NEXT: "/api/v1/queue/call-next",
    COMPLETE: "/api/v1/queue/complete", // Mark customer as served/completed
    LIST: "/api/v1/queue/shop", // Get queue list for a shop
    STATUS: "/queue/status",
    CONFIRM_ARRIVAL: "/queue/confirm-arrival",
    CANCEL: "/queue/cancel",
  },
  // Shop endpoints
  SHOP: {
    LIST: "/api/v1/shops",
    CREATE: "/api/v1/shops",
    INFO: "/shop/info",
    DASHBOARD: "/shop/dashboard",
    CALL_NEXT: "/shop/call-next",
    SKIP: "/api/v1/queue/skip",
    MARK_SERVED: "/api/v1/queue/mark-served",
    ADD_WALKIN: "/api/v1/queue/add-walkin",
    STATS: "/shop/stats",
  },
  // Analytics endpoints
  ANALYTICS: {
    SHOP: "/api/v1/analytics/shop",
    SHOP_TODAY: "/api/v1/analytics/shop",
  },
  // Admin endpoints
  ADMIN: {
    ONBOARD_SHOP_OWNER: "/api/v1/admin/shop-owners",
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

