/**
 * Local Storage utilities for session persistence
 */

import { STORAGE_KEYS } from "./constants";

class StorageService {
  /**
   * Set item in localStorage
   */
  setItem(key: string, value: unknown): void {
    try {
      if (typeof window === "undefined") return;
      const serialized = JSON.stringify(value);
      localStorage.setItem(key, serialized);
    } catch (error) {
      console.error("Error saving to localStorage:", error);
    }
  }

  /**
   * Get item from localStorage
   */
  getItem<T>(key: string): T | null {
    try {
      if (typeof window === "undefined") return null;
      const item = localStorage.getItem(key);
      if (!item) return null;
      return JSON.parse(item) as T;
    } catch (error) {
      console.error("Error reading from localStorage:", error);
      return null;
    }
  }

  /**
   * Remove item from localStorage
   */
  removeItem(key: string): void {
    try {
      if (typeof window === "undefined") return;
      localStorage.removeItem(key);
    } catch (error) {
      console.error("Error removing from localStorage:", error);
    }
  }

  /**
   * Clear all localStorage
   */
  clear(): void {
    try {
      if (typeof window === "undefined") return;
      localStorage.clear();
    } catch (error) {
      console.error("Error clearing localStorage:", error);
    }
  }

  // Convenience methods for specific keys
  setAuthToken(token: string): void {
    this.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
  }

  getAuthToken(): string | null {
    return this.getItem<string>(STORAGE_KEYS.AUTH_TOKEN);
  }

  removeAuthToken(): void {
    this.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  }

  setUserData<T>(data: T): void {
    this.setItem(STORAGE_KEYS.USER_DATA, data);
  }

  getUserData<T>(): T | null {
    return this.getItem<T>(STORAGE_KEYS.USER_DATA);
  }

  removeUserData(): void {
    this.removeItem(STORAGE_KEYS.USER_DATA);
  }

  setQueueToken(token: string): void {
    this.setItem(STORAGE_KEYS.QUEUE_TOKEN, token);
  }

  getQueueToken(): string | null {
    return this.getItem<string>(STORAGE_KEYS.QUEUE_TOKEN);
  }

  removeQueueToken(): void {
    this.removeItem(STORAGE_KEYS.QUEUE_TOKEN);
  }

  setShopId(shopId: string): void {
    this.setItem(STORAGE_KEYS.SHOP_ID, shopId);
  }

  getShopId(): string | null {
    return this.getItem<string>(STORAGE_KEYS.SHOP_ID);
  }

  removeShopId(): void {
    this.removeItem(STORAGE_KEYS.SHOP_ID);
  }

  setQueueData<T>(data: T): void {
    this.setItem("queue_data", data);
  }

  getQueueData<T>(): T | null {
    return this.getItem<T>("queue_data");
  }

  removeQueueData(): void {
    this.removeItem("queue_data");
  }
}

export const storage = new StorageService();

