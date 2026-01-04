/**
 * API service layer
 * Centralized API client using fetch
 */

import { config } from "./config";
import { storage } from "./storage";
import { STORAGE_KEYS } from "./constants";
import { ApiError, NetworkError, handleApiError } from "./errors";

export type RequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions {
  method?: RequestMethod;
  headers?: Record<string, string>;
  body?: unknown;
  requiresAuth?: boolean;
}

export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
}

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.apiUrl;
  }

  /**
   * Get default headers
   */
  private getDefaultHeaders(requiresAuth: boolean = false): HeadersInit {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (requiresAuth) {
      const token = storage.getAuthToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    return headers;
  }

  /**
   * Make API request
   */
  async request<T = unknown>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = "GET",
      headers = {},
      body,
      requiresAuth = false,
    } = options;

    const url = `${this.baseUrl}${endpoint}`;
    const defaultHeaders = this.getDefaultHeaders(requiresAuth);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          ...defaultHeaders,
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      // Handle non-JSON responses
      const contentType = response.headers.get("content-type");
      const isJson = contentType?.includes("application/json");

      let data: T;
      if (isJson) {
        data = await response.json();
      } else {
        data = (await response.text()) as unknown as T;
      }

      if (!response.ok) {
        throw new ApiError(
          (data as { message?: string })?.message ||
            `Request failed with status ${response.status}`,
          response.status,
          response.statusText,
          data
        );
      }

      return {
        data,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error) {
      // Handle network errors
      if (error instanceof TypeError && error.message === "Failed to fetch") {
        throw new NetworkError();
      }

      // Re-throw ApiError
      if (error instanceof ApiError) {
        throw error;
      }

      // Handle other errors
      throw new NetworkError(handleApiError(error));
    }
  }

  /**
   * GET request
   */
  get<T = unknown>(endpoint: string, requiresAuth: boolean = false) {
    return this.request<T>(endpoint, { method: "GET", requiresAuth });
  }

  /**
   * POST request
   */
  post<T = unknown>(
    endpoint: string,
    body?: unknown,
    requiresAuth: boolean = false
  ) {
    return this.request<T>(endpoint, {
      method: "POST",
      body,
      requiresAuth,
    });
  }

  /**
   * PUT request
   */
  put<T = unknown>(
    endpoint: string,
    body?: unknown,
    requiresAuth: boolean = false
  ) {
    return this.request<T>(endpoint, {
      method: "PUT",
      body,
      requiresAuth,
    });
  }

  /**
   * PATCH request
   */
  patch<T = unknown>(
    endpoint: string,
    body?: unknown,
    requiresAuth: boolean = false
  ) {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body,
      requiresAuth,
    });
  }

  /**
   * DELETE request
   */
  delete<T = unknown>(endpoint: string, requiresAuth: boolean = false) {
    return this.request<T>(endpoint, { method: "DELETE", requiresAuth });
  }
}

export const api = new ApiService();

