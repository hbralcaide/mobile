require('dotenv').config();
const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');

const PORT = process.env.PORT || 8080;

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

// Create WebSocket server
const wss = new WebSocket.Server({ port: PORT });

// Store connected clients with their subscribed categories
const clients = new Map(); // Map<WebSocket, Set<categoryId>>

console.log(`[WebSocket Server] Starting on port ${PORT}...`);

// Handle client connections
wss.on('connection', (ws) => {
  const clientId = Math.random().toString(36).substring(7);
  console.log(`[WS] Client connected: ${clientId}`);
  
  // Initialize client's subscribed categories
  clients.set(ws, new Set());

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    clientId: clientId,
    message: 'Connected to Mapalengke real-time server'
  }));

  // Handle messages from client
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log(`[WS] Message from ${clientId}:`, data);

      switch (data.type) {
        case 'subscribe':
          handleSubscribe(ws, data.categoryId);
          break;
        case 'unsubscribe':
          handleUnsubscribe(ws, data.categoryId);
          break;
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        default:
          console.log(`[WS] Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error(`[WS] Error parsing message from ${clientId}:`, error);
    }
  });

  // Handle client disconnect
  ws.on('close', () => {
    console.log(`[WS] Client disconnected: ${clientId}`);
    clients.delete(ws);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error(`[WS] Error for client ${clientId}:`, error);
  });
});

// Subscribe client to a category
function handleSubscribe(ws, categoryId) {
  if (!categoryId) {
    console.error('[WS] Subscribe: No categoryId provided');
    return;
  }

  const subscribedCategories = clients.get(ws);
  if (subscribedCategories) {
    subscribedCategories.add(categoryId);
    console.log(`[WS] Client subscribed to category: ${categoryId}`);
    
    ws.send(JSON.stringify({
      type: 'subscribed',
      categoryId: categoryId,
      message: `Subscribed to category updates`
    }));
  }
}

// Unsubscribe client from a category
function handleUnsubscribe(ws, categoryId) {
  const subscribedCategories = clients.get(ws);
  if (subscribedCategories && categoryId) {
    subscribedCategories.delete(categoryId);
    console.log(`[WS] Client unsubscribed from category: ${categoryId}`);
    
    ws.send(JSON.stringify({
      type: 'unsubscribed',
      categoryId: categoryId
    }));
  }
}

// Broadcast message to clients subscribed to a specific category
function broadcastToCategory(categoryId, message) {
  let count = 0;
  clients.forEach((subscribedCategories, ws) => {
    if (subscribedCategories.has(categoryId) && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      count++;
    }
  });
  console.log(`[WS] Broadcasted to ${count} client(s) for category: ${categoryId}`);
}

// Broadcast to all connected clients
function broadcastToAll(message) {
  let count = 0;
  clients.forEach((_, ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      count++;
    }
  });
  console.log(`[WS] Broadcasted to ${count} client(s)`);
}

// Subscribe to Supabase Realtime for vendor_products changes
console.log('[Supabase] Setting up realtime subscriptions...');

const vendorProductsChannel = supabase
  .channel('vendor_products_changes')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'vendor_products',
    },
    async (payload) => {
      console.log('[Supabase] vendor_products change detected:', payload.eventType);
      
      try {
        // Get the product details to find the category
        const productId = payload.new?.product_id || payload.old?.product_id;
        
        if (productId) {
          const { data: product, error } = await supabase
            .from('products')
            .select('category_id')
            .eq('id', productId)
            .single();

          if (error) {
            console.error('[Supabase] Error fetching product:', error);
            return;
          }

          if (product && product.category_id) {
            console.log(`[Supabase] Broadcasting change to category: ${product.category_id}`);
            
            // Broadcast to clients subscribed to this category
            broadcastToCategory(product.category_id, {
              type: 'vendor_product_change',
              event: payload.eventType,
              categoryId: product.category_id,
              productId: productId,
              vendorProductId: payload.new?.id || payload.old?.id,
              timestamp: new Date().toISOString()
            });
          }
        }
      } catch (error) {
        console.error('[Supabase] Error processing change:', error);
      }
    }
  )
  .subscribe((status) => {
    console.log('[Supabase] vendor_products subscription status:', status);
  });

// Subscribe to products changes (for new products added)
const productsChannel = supabase
  .channel('products_changes')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'products',
    },
    async (payload) => {
      console.log('[Supabase] products change detected:', payload.eventType);
      
      try {
        const categoryId = payload.new?.category_id || payload.old?.category_id;
        const productId = payload.new?.id || payload.old?.id;
        
        if (categoryId) {
          console.log(`[Supabase] Broadcasting product change to category: ${categoryId}`);
          
          // Broadcast to clients subscribed to this category
          broadcastToCategory(categoryId, {
            type: 'product_change',
            event: payload.eventType,
            categoryId: categoryId,
            productId: productId,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('[Supabase] Error processing product change:', error);
      }
    }
  )
  .subscribe((status) => {
    console.log('[Supabase] products subscription status:', status);
  });

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, closing...');
  vendorProductsChannel.unsubscribe();
  productsChannel.unsubscribe();
  wss.close(() => {
    console.log('[Server] WebSocket server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received, closing...');
  vendorProductsChannel.unsubscribe();
  productsChannel.unsubscribe();
  wss.close(() => {
    console.log('[Server] WebSocket server closed');
    process.exit(0);
  });
});

console.log('[Server] Mapalengke Real-time WebSocket Server is running!');
console.log(`[Server] WebSocket endpoint: ws://localhost:${PORT}`);
console.log('[Server] Waiting for connections...');
