/**
 * WebSocket service using STOMP protocol
 * Handles WebSocket connections and real-time updates via STOMP
 */

import { Client, IMessage, StompSubscription } from "@stomp/stompjs";
import { config } from "./config";
import { WS_EVENTS } from "./constants";
import { storage } from "./storage";

export type WebSocketEventType = keyof typeof WS_EVENTS;

export interface WebSocketMessage {
  type: WebSocketEventType;
  data: unknown;
}

export type WebSocketEventHandler = (data: unknown) => void;

interface TopicSubscription {
  topic: string;
  subscription: StompSubscription;
  handler: (message: IMessage) => void;
}

class WebSocketService {
  private client: Client | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000; // 5 seconds
  private eventHandlers: Map<WebSocketEventType, Set<WebSocketEventHandler>> =
    new Map();
  private isConnecting = false;
  private shouldReconnect = true;
  private subscriptions: Map<string, TopicSubscription> = new Map();
  private connected = false;

  constructor() {
    // Ensure WebSocket URL is correct format for STOMP
    let baseUrl = config.wsUrl;
    // Convert http:// to ws:// or https:// to wss://
    if (baseUrl.startsWith("http://")) {
      baseUrl = baseUrl.replace("http://", "ws://");
    } else if (baseUrl.startsWith("https://")) {
      baseUrl = baseUrl.replace("https://", "wss://");
    }
    // Ensure it starts with ws:// or wss://
    if (!baseUrl.startsWith("ws://") && !baseUrl.startsWith("wss://")) {
      baseUrl = "ws://" + baseUrl.replace(/^\/+/, "");
    }
    // Append /ws endpoint
    this.url = baseUrl.endsWith("/ws") ? baseUrl : baseUrl + "/ws";
  }

  /**
   * Connect to WebSocket server using STOMP
   */
  connect(path: string = ""): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.client?.active) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        reject(new Error("Connection already in progress"));
        return;
      }

      this.isConnecting = true;
      const token = storage.getAuthToken();

      try {
        this.client = new Client({
          brokerURL: this.url,
          connectHeaders: {
            Authorization: token ? `Bearer ${token}` : "",
          },
          reconnectDelay: this.reconnectDelay,
          heartbeatIncoming: 4000,
          heartbeatOutgoing: 4000,
          onConnect: (frame) => {
            console.log("STOMP Connected:", frame);
            this.isConnecting = false;
            this.connected = true;
            this.reconnectAttempts = 0;
            this.emit(WS_EVENTS.CONNECTION_ESTABLISHED, {});
            resolve();
          },
          onStompError: (frame) => {
            console.error("STOMP Error:", frame);
            this.isConnecting = false;
            this.connected = false;
            this.emit(WS_EVENTS.CONNECTION_ERROR, frame);
            reject(new Error(frame.headers["message"] || "STOMP connection error"));
          },
          onWebSocketError: (event) => {
            console.error("WebSocket Error:", event);
            this.isConnecting = false;
            this.connected = false;
            this.emit(WS_EVENTS.CONNECTION_ERROR, event);
            reject(event);
          },
          onDisconnect: () => {
            console.log("STOMP Disconnected");
            this.connected = false;
            this.emit(WS_EVENTS.CONNECTION_CLOSED, {});
            this.handleReconnect(path);
          },
        });

        this.client.activate();
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.shouldReconnect = false;
    
    // Unsubscribe from all topics
    this.subscriptions.forEach((sub) => {
      try {
        sub.subscription.unsubscribe();
      } catch (error) {
        console.error("Error unsubscribing:", error);
      }
    });
    this.subscriptions.clear();

    if (this.client) {
      this.client.deactivate();
      this.client = null;
    }
    this.connected = false;
  }

  /**
   * Subscribe to a STOMP topic
   */
  subscribe(
    topic: string,
    handler: (data: unknown) => void
  ): () => void {
    if (!this.client?.active) {
      console.warn("STOMP client is not connected. Cannot subscribe to:", topic);
      return () => {};
    }

    // If already subscribed, add handler to existing subscription
    if (this.subscriptions.has(topic)) {
      const existing = this.subscriptions.get(topic)!;
      const originalHandler = existing.handler;
      existing.handler = (message: IMessage) => {
        originalHandler(message);
        try {
          const data = JSON.parse(message.body);
          handler(data);
        } catch (error) {
          console.error("Error parsing STOMP message:", error);
          handler(message.body);
        }
      };
      return () => {
        // Unsubscribe logic would need to be more complex here
        // For now, just remove from map
        this.subscriptions.delete(topic);
      };
    }

    try {
      const subscription = this.client.subscribe(topic, (message: IMessage) => {
        try {
          const data = JSON.parse(message.body);
          handler(data);
        } catch (error) {
          console.error("Error parsing STOMP message:", error);
          handler(message.body);
        }
      });

      this.subscriptions.set(topic, {
        topic,
        subscription,
        handler: (message: IMessage) => {
          try {
            const data = JSON.parse(message.body);
            handler(data);
          } catch (error) {
            console.error("Error parsing STOMP message:", error);
            handler(message.body);
          }
        },
      });

      console.log("Subscribed to topic:", topic);

      // Return unsubscribe function
      return () => {
        try {
          subscription.unsubscribe();
          this.subscriptions.delete(topic);
          console.log("Unsubscribed from topic:", topic);
        } catch (error) {
          console.error("Error unsubscribing:", error);
        }
      };
    } catch (error) {
      console.error("Error subscribing to topic:", topic, error);
      return () => {};
    }
  }

  /**
   * Send message through WebSocket (STOMP)
   */
  send(destination: string, body: unknown): void {
    if (!this.client?.active) {
      console.warn("STOMP client is not connected. Message not sent:", {
        destination,
        body,
      });
      return;
    }

    try {
      this.client.publish({
        destination,
        body: JSON.stringify(body),
      });
    } catch (error) {
      console.error("Error sending STOMP message:", error);
    }
  }

  /**
   * Subscribe to WebSocket events (legacy API for compatibility)
   */
  on(event: WebSocketEventType, handler: WebSocketEventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.off(event, handler);
    };
  }

  /**
   * Unsubscribe from WebSocket events
   */
  off(event: WebSocketEventType, handler: WebSocketEventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.connected && this.client?.active === true;
  }

  /**
   * Get connection state
   */
  getState(): number | null {
    if (!this.client) return null;
    // STOMP client states: 0 = CONNECTING, 1 = OPEN, 2 = CLOSING, 3 = CLOSED
    // WebSocket states: 0 = CONNECTING, 1 = OPEN, 2 = CLOSING, 3 = CLOSED
    return this.client.webSocket?.readyState ?? null;
  }

  /**
   * Emit event to handlers
   */
  private emit(event: WebSocketEventType, data: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error emitting WebSocket event ${event}:`, error);
        }
      });
    }
  }

  /**
   * Handle reconnection logic
   */
  private handleReconnect(path: string): void {
    if (!this.shouldReconnect || this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error("Max reconnection attempts reached");
      }
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    setTimeout(() => {
      console.log(
        `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
      );
      this.connect(path).catch((error) => {
        console.error("Reconnection failed:", error);
      });
    }, delay);
  }
}

export const wsService = new WebSocketService();
