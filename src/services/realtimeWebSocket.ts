/**
 * WebSocket Real-time Service
 * Connects to WebSocket server for real-time updates
 */

class RealtimeWebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private subscribedCategories: Set<string> = new Set();
  private url: string;
  private isIntentionallyClosed = false;

  constructor(url: string) {
    this.url = url;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        console.log('[WebSocket] Already connected');
        resolve();
        return;
      }

      this.isIntentionallyClosed = false;
      console.log(`[WebSocket] Connecting to ${this.url}...`);

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('[WebSocket] Connected successfully');
          this.reconnectAttempts = 0;
          this.startPing();
          
          // Re-subscribe to all previously subscribed categories
          this.subscribedCategories.forEach((categoryId) => {
            this.sendMessage({ type: 'subscribe', categoryId });
          });
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('[WebSocket] Message received:', data.type);
            this.handleMessage(data);
          } catch (error) {
            console.error('[WebSocket] Error parsing message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[WebSocket] Error:', error);
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log('[WebSocket] Connection closed:', event.code, event.reason);
          this.stopPing();
          
          if (!this.isIntentionallyClosed && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };
      } catch (error) {
        console.error('[WebSocket] Connection error:', error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    this.isIntentionallyClosed = true;
    this.stopPing();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.subscribedCategories.clear();
    console.log('[WebSocket] Disconnected');
  }

  /**
   * Subscribe to a category's updates
   */
  subscribeToCategory(categoryId: string, callback: (data: any) => void) {
    console.log(`[WebSocket] Subscribing to category: ${categoryId}`);
    
    // Add to local listeners
    if (!this.listeners.has(categoryId)) {
      this.listeners.set(categoryId, new Set());
    }
    this.listeners.get(categoryId)?.add(callback);
    
    // Subscribe on server
    this.subscribedCategories.add(categoryId);
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendMessage({ type: 'subscribe', categoryId });
    }
  }

  /**
   * Unsubscribe from a category's updates
   */
  unsubscribeFromCategory(categoryId: string, callback?: (data: any) => void) {
    console.log(`[WebSocket] Unsubscribing from category: ${categoryId}`);
    
    if (callback) {
      // Remove specific callback
      this.listeners.get(categoryId)?.delete(callback);
    } else {
      // Remove all callbacks for this category
      this.listeners.delete(categoryId);
    }
    
    // If no more listeners for this category, unsubscribe from server
    if (!this.listeners.has(categoryId) || this.listeners.get(categoryId)?.size === 0) {
      this.subscribedCategories.delete(categoryId);
      
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendMessage({ type: 'unsubscribe', categoryId });
      }
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: any) {
    switch (data.type) {
      case 'connected':
        console.log('[WebSocket] Server connected:', data.clientId);
        break;
        
      case 'subscribed':
        console.log('[WebSocket] Subscribed to category:', data.categoryId);
        break;
        
      case 'vendor_product_change':
      case 'product_change':
        console.log(`[WebSocket] ${data.type} for category:`, data.categoryId, 'event:', data.event);
        this.notifyListeners(data.categoryId, data);
        break;
        
      case 'pong':
        // Heartbeat response
        break;
        
      default:
        console.log('[WebSocket] Unknown message type:', data.type);
    }
  }

  /**
   * Notify all listeners for a category
   */
  private notifyListeners(categoryId: string, data: any) {
    const listeners = this.listeners.get(categoryId);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error('[WebSocket] Error in listener callback:', error);
        }
      });
    }
  }

  /**
   * Send message to server
   */
  private sendMessage(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocket] Cannot send message, not connected');
    }
  }

  /**
   * Start heartbeat ping
   */
  private startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendMessage({ type: 'ping' });
      }
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Stop heartbeat ping
   */
  private stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect() {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((error) => {
        console.error('[WebSocket] Reconnect failed:', error);
      });
    }, delay);
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Create singleton instance
// Replace with your server's IP address when testing on physical devices
// For local testing: ws://localhost:8080
// For network testing: ws://YOUR_COMPUTER_IP:8080
const WEBSOCKET_URL = __DEV__ 
  ? 'ws://192.168.254.102:8080'  // Your computer's local IP
  : 'wss://your-production-server.com';

export const realtimeWS = new RealtimeWebSocketService(WEBSOCKET_URL);

export default realtimeWS;
