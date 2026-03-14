# Testing Webhooks Locally

## 🧪 Test Token Purchase (Auto-Join Battle)

```bash
curl -X POST http://localhost:3001/api/webhooks/token-purchase \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "txSignature": "5wHu1qwD7q5T8Qx9Zy3xCv2mN8pL4kJ6hG9fE2dR1aS3bT7yV5nM4jK8iH6gF3eD2cB1zA",
    "tokenAmount": 100,
    "timestamp": "2026-03-08T10:30:00Z"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Token purchase processed"
}
```

**Expected Console Output:**
```
📥 Token purchase received: 7xKXtg2C...
✅ Transaction verified: 5wHu1qwD...
✅ Participant joined: 7xKXtg2C... (Round 1)
✅ Auto-joined battle: 7xKXtg2C...
```

**Socket.IO Events Emitted:**
- `live-purchase` - Broadcast to all clients
- `participant-joined` - Broadcast participant count update

---

## 🔥 Test Token Sell (Character Destruction)

```bash
curl -X POST http://localhost:3001/api/webhooks/token-sell \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "txSignature": "3aB4cD5eF6gH7iJ8kL9mN0pQ1rS2tU3vW4xY5zA6bC7dE8fG9hI0jK1lM2nO3pQ4rS",
    "tokenAmount": 50,
    "timestamp": "2026-03-08T10:35:00Z"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Token sell processed"
}
```

**Expected Console Output:**
```
📤 Token sell detected: 7xKXtg2C...
✅ Transaction verified: 3aB4cD5e...
🔥 Destroyed 1 characters for 7xKXtg2C...
❌ Removed participant: 7xKXtg2C... (Token sold)
```

**Socket.IO Events Emitted:**
- `character-destroyed` - Notify all clients
- `participant-removed` - Update participant count

---

## 🧪 Test Multiple Purchases (Same Round)

```bash
# User 1 buys tokens
curl -X POST http://localhost:3001/api/webhooks/token-purchase \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "User1111111111111111111111111111111111111",
    "txSignature": "tx1111111111111111111111111111111111111111111111111111111111111111",
    "tokenAmount": 50
  }'

# User 2 buys tokens
curl -X POST http://localhost:3001/api/webhooks/token-purchase \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "User2222222222222222222222222222222222222",
    "txSignature": "tx2222222222222222222222222222222222222222222222222222222222222222",
    "tokenAmount": 75
  }'

# User 3 buys tokens
curl -X POST http://localhost:3001/api/webhooks/token-purchase \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "User3333333333333333333333333333333333333",
    "txSignature": "tx3333333333333333333333333333333333333333333333333333333333333333",
    "tokenAmount": 120
  }'
```

**Expected:**
- 3 participants joined
- Timer shows participant count: 3
- All clients receive 3 `participant-joined` events

---

## 🚫 Test Duplicate Purchase (Same Wallet, Same Round)

```bash
# First purchase - should succeed
curl -X POST http://localhost:3001/api/webhooks/token-purchase \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "DuplicateWallet111111111111111111111111111",
    "txSignature": "txDuplicate1111111111111111111111111111111111111111111111111111111",
    "tokenAmount": 100
  }'

# Second purchase (same wallet, different tx) - should be ignored
curl -X POST http://localhost:3001/api/webhooks/token-purchase \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "DuplicateWallet111111111111111111111111111",
    "txSignature": "txDuplicate2222222222222222222222222222222222222222222222222222222",
    "tokenAmount": 50
  }'
```

**Expected:**
- First purchase: Success
- Second purchase: Logged as already joined, but webhook returns success

---

## 📊 Check Database State

```bash
# Connect to PostgreSQL
psql pumpedout

# View participants
SELECT * FROM participants;

# View token transactions
SELECT * FROM token_transactions ORDER BY timestamp DESC LIMIT 10;

# View characters
SELECT * FROM characters WHERE "isActive" = true;
```

---

## 🔍 Monitor Socket.IO Events (Browser Console)

```javascript
// In browser console (after connecting to frontend)
const socket = io('http://localhost:3001');

socket.on('participant-joined', (data) => {
  console.log('👤 Participant joined:', data);
});

socket.on('live-purchase', (data) => {
  console.log('💰 Token purchased:', data);
});

socket.on('character-destroyed', (data) => {
  console.log('🔥 Character destroyed:', data);
});

socket.on('participant-removed', (data) => {
  console.log('❌ Participant removed:', data);
});
```

---

## ⚠️ Error Cases

### Invalid Wallet Address
```bash
curl -X POST http://localhost:3001/api/webhooks/token-purchase \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "invalid",
    "txSignature": "tx123",
    "tokenAmount": 50
  }'
```
**Expected:** Transaction verification fails, no participant added

### Missing Required Fields
```bash
curl -X POST http://localhost:3001/api/webhooks/token-purchase \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
  }'
```
**Expected:** 400 error - "Missing required fields"

### Purchase When Timer Inactive
```bash
# Wait for timer to end, then:
curl -X POST http://localhost:3001/api/webhooks/token-purchase \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "txSignature": "tx_after_timer_end",
    "tokenAmount": 100
  }'
```
**Expected:** Purchase logged but no battle entry (battle window closed)

---

## 🎯 Complete Test Flow

```bash
# 1. Start server
npm run dev

# 2. Wait for timer to start (auto-starts in dev mode)

# 3. Purchase tokens (multiple users)
# Use curl commands above

# 4. Wait for timer to end (30 seconds)

# 5. Check battle was created
# SELECT * FROM battles WHERE "roundId" = 1;

# 6. Sell tokens (test character destruction)
# Use token-sell webhook

# 7. Verify character destroyed
# SELECT * FROM characters WHERE "destroyedAt" IS NOT NULL;
```

---

**Note:** Solana transaction verification will fail for fake transactions in development. For testing, you can temporarily comment out the verification check in `live-purchases.ts` or use real Solana devnet transactions.
