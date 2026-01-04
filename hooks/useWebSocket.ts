"use client";

/**
 * Custom hook for WebSocket integration
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { wsService } from "@/services/websocket";
import { WS_EVENTS, WebSocketEventType } from "@/services/constants";
import type { WebSocketEventHandler } from "@/services/websocket";

interface UseWebSocketOptions {
  path?: string;
  autoConnect?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    path = "",
    autoConnect = true,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<number | null>(null);
  const handlersRef = useRef<Map<WebSocketEventType, WebSocketEventHandler>>(
    new Map()
  );

  // Connect to WebSocket
  const connect = useCallback(async () => {
    try {
      await wsService.connect(path);
      setIsConnected(true);
      setConnectionState(wsService.getState());
      onConnect?.();
    } catch (error) {
      console.error("WebSocket connection error:", error);
      onError?.(error as Event);
    }
  }, [path, onConnect, onError]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    wsService.disconnect();
    setIsConnected(false);
    setConnectionState(null);
    onDisconnect?.();
  }, [onDisconnect]);

  // Send message
  const send = useCallback((type: string, data: unknown) => {
    wsService.send(type, data);
  }, []);

  // Subscribe to event
  const on = useCallback(
    (event: WebSocketEventType, handler: WebSocketEventHandler) => {
      const unsubscribe = wsService.on(event, handler);
      handlersRef.current.set(event, handler);
      return unsubscribe;
    },
    []
  );

  // Unsubscribe from event
  const off = useCallback((event: WebSocketEventType) => {
    const handler = handlersRef.current.get(event);
    if (handler) {
      wsService.off(event, handler);
      handlersRef.current.delete(event);
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      // Unsubscribe all handlers
      handlersRef.current.forEach((handler, event) => {
        wsService.off(event, handler);
      });
      handlersRef.current.clear();

      // Disconnect if component unmounts
      if (autoConnect) {
        disconnect();
      }
    };
  }, [autoConnect, connect, disconnect]);

  // Listen to connection events
  useEffect(() => {
    const handleConnectionEstablished = () => {
      setIsConnected(true);
      setConnectionState(wsService.getState());
    };

    const handleConnectionClosed = () => {
      setIsConnected(false);
      setConnectionState(wsService.getState());
    };

    const handleConnectionError = () => {
      setIsConnected(false);
      setConnectionState(wsService.getState());
    };

    wsService.on(WS_EVENTS.CONNECTION_ESTABLISHED, handleConnectionEstablished);
    wsService.on(WS_EVENTS.CONNECTION_CLOSED, handleConnectionClosed);
    wsService.on(WS_EVENTS.CONNECTION_ERROR, handleConnectionError);

    return () => {
      wsService.off(WS_EVENTS.CONNECTION_ESTABLISHED, handleConnectionEstablished);
      wsService.off(WS_EVENTS.CONNECTION_CLOSED, handleConnectionClosed);
      wsService.off(WS_EVENTS.CONNECTION_ERROR, handleConnectionError);
    };
  }, []);

  return {
    isConnected,
    connectionState,
    connect,
    disconnect,
    send,
    on,
    off,
  };
}

