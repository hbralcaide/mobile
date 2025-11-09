# Mapalengke Real-time WebSocket Server

WebSocket server for broadcasting real-time updates to the Mapalengke mobile app.

## Features

- Real-time product updates via WebSocket
- Category-based subscriptions (clients only receive updates for categories they're viewing)
- Automatic reconnection with exponential backoff
- Heartbeat ping/pong to maintain connection
- Supabase integration for database change notifications

## Setup

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and update with your Supabase credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
PORT=8080
```

### 3. Start Server

Development mode (with auto-restart):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will start on `ws://localhost:8080` (or the port specified in `.env`)

## Client Configuration

Update the WebSocket URL in `src/services/realtimeWebSocket.ts`:

### For Local Testing (Emulator)
```typescript
const WEBSOCKET_URL = 'ws://localhost:8080';
```

### For Physical Device Testing
Find your computer's local IP address:

**Windows:**
```bash
ipconfig
# Look for "IPv4 Address" under your active network adapter
```

**Mac/Linux:**
```bash
ifconfig | grep "inet "
```

Then update the URL:
```typescript
const WEBSOCKET_URL = 'ws://192.168.1.100:8080';  // Replace with your IP
```

**Important:** Make sure your phone and computer are on the same WiFi network!

### For Production
```typescript
const WEBSOCKET_URL = 'wss://your-server-domain.com';
```

## How It Works

1. **Server** listens to Supabase Realtime for changes in `vendor_products` and `products` tables
2. When a change occurs, the server fetches the associated category_id
3. Server broadcasts the change only to clients subscribed to that category
4. **Client** (mobile app) subscribes to categories when user views them
5. Client receives updates and refreshes the vendor list automatically

## WebSocket Messages

### Client → Server

**Subscribe to category:**
```json
{
  "type": "subscribe",
  "categoryId": "uuid-of-category"
}
```

**Unsubscribe from category:**
```json
{
  "type": "unsubscribe",
  "categoryId": "uuid-of-category"
}
```

**Ping (heartbeat):**
```json
{
  "type": "ping"
}
```

### Server → Client

**Connection established:**
```json
{
  "type": "connected",
  "clientId": "random-client-id",
  "message": "Connected to Mapalengke real-time server"
}
```

**Subscription confirmed:**
```json
{
  "type": "subscribed",
  "categoryId": "uuid-of-category",
  "message": "Subscribed to category updates"
}
```

**Product change notification:**
```json
{
  "type": "vendor_product_change",
  "event": "INSERT|UPDATE|DELETE",
  "categoryId": "uuid-of-category",
  "productId": "uuid-of-product",
  "vendorProductId": "uuid-of-vendor-product",
  "timestamp": "2025-11-09T01:00:00.000Z"
}
```

**Pong (heartbeat response):**
```json
{
  "type": "pong"
}
```

## Testing

### 1. Start the Server
```bash
cd server
npm start
```

You should see:
```
[WebSocket Server] Starting on port 8080...
[Server] Mapalengke Real-time WebSocket Server is running!
[Server] WebSocket endpoint: ws://localhost:8080
[Supabase] Setting up realtime subscriptions...
[Supabase] vendor_products subscription status: SUBSCRIBED
[Supabase] products subscription status: SUBSCRIBED
```

### 2. Test on Two Phones

**Phone 1 (Shopper):**
1. Open the app
2. Go to Market screen
3. Tap on "Fish" category
4. Watch logs for: `[WebSocket] Connected, subscribing to category`

**Phone 2 (Vendor):**
1. Open vendor dashboard
2. Add a new Fish product
3. Watch server logs for broadcast

**Phone 1 (Shopper):**
- Should see vendor list refresh automatically
- Check logs for: `[WebSocket] Category update received`

## Troubleshooting

### "Connection refused" or "Failed to connect"

1. **Check server is running:**
   ```bash
   # In server directory
   npm start
   ```

2. **Check firewall:**
   - Windows: Allow Node.js through Windows Firewall
   - Mac: System Preferences → Security & Privacy → Firewall

3. **Verify IP address:**
   - Make sure you're using the correct local IP in the app
   - Phone and computer must be on same WiFi network

4. **Check port availability:**
   ```bash
   # Windows
   netstat -ano | findstr :8080
   
   # Mac/Linux
   lsof -i :8080
   ```

### "Supabase subscription not working"

1. **Check Supabase credentials:**
   - Verify SUPABASE_URL and SUPABASE_ANON_KEY in `.env`

2. **Check Supabase Realtime settings:**
   - Go to Supabase Dashboard → Database → Replication
   - Enable `vendor_products` and `products` tables

3. **Check server logs:**
   - Should see "SUBSCRIBED" status for both tables

### "Connected but no updates received"

1. **Check category subscription:**
   - Verify `selectedCategoryId` is correct
   - Check server logs for "Client subscribed to category"

2. **Test with direct database change:**
   - Use Supabase SQL Editor to insert/update/delete
   - Check if server receives the change

## Production Deployment

For production, deploy the WebSocket server to a cloud provider:

- **Heroku**: `git push heroku main`
- **AWS**: EC2 + Load Balancer
- **DigitalOcean**: Droplet + Nginx
- **Railway/Render**: One-click deployment

**Important:** Use `wss://` (secure WebSocket) in production!

## License

Copyright © 2025 Mapalengke
