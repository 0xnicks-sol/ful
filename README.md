# Pumped Out Battle — Platform Documentation

A real-time, on-chain battle arena where token holders automatically enter a 30-second fight window. After each round a winner is selected using Solana blockhash randomness, an animated fight plays out, and a live leaderboard tracks victories. After 10 rounds the top 3 champions receive SOL rewards sent directly from a prize wallet — no custom smart contract required.

---

## Table of Contents

1. [How It Works — Plain English](#1-how-it-works--plain-english)
2. [Full System Flow](#2-full-system-flow)
3. [Architecture Overview](#3-architecture-overview)
4. [Project Structure](#4-project-structure)
5. [The Battle Lifecycle](#5-the-battle-lifecycle)
6. [Token Buy → Auto Join](#6-token-buy--auto-join)
7. [Token Sell → Kicked Out](#7-token-sell--kicked-out)
8. [Reward Distribution (No Contract)](#8-reward-distribution-no-contract)
9. [Frontend UI](#9-frontend-ui)
10. [Real-Time Events (Socket.IO)](#10-real-time-events-socketio)
11. [API Reference](#11-api-reference)
12. [Database Schema](#12-database-schema)
13. [Environment Variables](#13-environment-variables)
14. [Setup Guide — Step by Step](#14-setup-guide--step-by-step)
15. [Deployment](#15-deployment)

---

## 1. How It Works — Plain English

1. **You create a token on pump.fun** (2 minutes, zero coding).
2. **Anyone who buys that token** during an active 30-second window **automatically enters the battle**.
3. **A countdown timer** visible to everyone runs for 30 seconds. Every second it broadcasts the remaining time to all connected browsers in real time.
4. When the timer hits zero, the **battle engine picks a winner** using the latest Solana blockhash as a random seed.
5. An **animated fight plays** on screen for ~45 seconds.
6. The **winner is revealed** and the leaderboard updates.
7. A new round starts 10 seconds later — automatically.
8. This repeats for **10 rounds**.
9. After round 10, the backend **sends SOL directly** from a funded prize wallet to the top 3 wallets (50 / 30 / 20 split). Every transfer is a verifiable Solana transaction.
10. If someone **sells their token**, they are instantly removed from the active battle.

---

## 2. Full System Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER ACTION                                      │
│   Buys your token on pump.fun / Raydium                                  │
└────────────────────────────┬────────────────────────────────────────────┘
                             │  on-chain SWAP transaction confirmed
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         HELIUS WEBHOOK                                   │
│   Helius detects the SWAP for your token mint                            │
│   POST https://your-backend.com/api/webhooks/helius                      │
│   Body: { signature, feePayer, tokenTransfers: [{ mint, toUserAccount }]}│
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      helius.controller.ts                                │
│   1. Verify HMAC signature (HELIUS_WEBHOOK_SECRET)                       │
│   2. Filter transfers → find your SPL_TOKEN_MINT                         │
│   3. Determine: BUY (tokens flow TO user) or SELL (tokens flow FROM user)│
│   4. Route to live-purchases.ts                                          │
└────────────┬───────────────────────────────────┬────────────────────────┘
             │ BUY                               │ SELL
             ▼                                   ▼
┌────────────────────────┐           ┌────────────────────────────────────┐
│  livePurchases         │           │  livePurchases                     │
│  .handlePurchase()     │           │  .handleSell()                     │
│                        │           │                                    │
│  • Verify TX on Solana │           │  • Verify TX on Solana             │
│  • Log to DB           │           │  • Destroy character in DB         │
│  • If timer ACTIVE →   │           │  • Remove from active battle       │
│    auto-join battle    │           │  • Broadcast character-destroyed   │
│  • Broadcast live-     │           └────────────────────────────────────┘
│    purchase event      │
└────────────┬───────────┘
             │ timer is active
             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      battle-entry.ts                                     │
│   • Check round is open (timer must be active)                           │
│   • Prevent duplicate entry (unique constraint on battleId+wallet)       │
│   • Create Participant row in PostgreSQL                                 │
│   • Increment participantCount on Battle row                             │
│   • timerService.incrementParticipantCount()                             │
│   • Emit "participant-joined" via Socket.IO → all browsers update        │
└─────────────────────────────────────────────────────────────────────────┘
                             │
                             │  30 seconds pass…
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      timer-service.ts                                    │
│   • countdown reaches 0                                                  │
│   • Emits "timer-end" event                                              │
│   • Emits "battle-execution-trigger" via Socket.IO                       │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      battle-engine.ts                                    │
│                                                                          │
│   STEP 1: Fetch all participants for this round from DB                  │
│   STEP 2: Get latest Solana blockhash (used as random seed)              │
│   STEP 3: winnerIndex = sum(charCodes of blockhash) % participants.length│
│   STEP 4: Update Battle status → FIGHTING                                │
│   STEP 5: Emit "fight-started" → all browsers play animation            │
│   STEP 6: Wait 45 seconds (fight animation duration)                     │
│   STEP 7: Update Battle status → WINNER_REVEAL                           │
│   STEP 8: Emit "battle-result" { winner: walletAddress }                 │
│   STEP 9: Update Leaderboard (wins + 1 for winner)                       │
│   STEP 10: Emit "leaderboard-update"                                     │
│                                                                          │
│   If roundId < 10 → wait 10s → start next round                         │
│   If roundId == 10 → distributeRewards(top3)                             │
└─────────────────────────────────────────────────────────────────────────┘
                             │ round 10 complete
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      reward-service.ts                                   │
│   • Query leaderboard → top 3 wallets by wins                            │
│   • Get prize wallet balance                                             │
│   • Send 3 separate Solana SystemProgram.transfer transactions:          │
│       1st place  →  50% of balance                                       │
│       2nd place  →  30% of balance                                       │
│       3rd place  →  20% of balance                                       │
│   • Log to Reward table in DB                                            │
│   • Emit "rewards-distributed" with TX signatures                        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      BROWSER (Next.js)                           │
│  localhost:4000  /  yourfrontend.vercel.app                      │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │  Battle Arena    │  │ Wallet Feed  │  │  Leaderboard    │   │
│  │  (fight ring)    │  │ (right panel)│  │  (bottom)       │   │
│  └──────────────────┘  └──────────────┘  └─────────────────┘   │
│           │                  │                   │              │
│           └──────────────────┴───────────────────┘             │
│                        useBattleSocket.ts                        │
└────────────────────────────┬────────────────────────────────────┘
                             │ WebSocket (Socket.IO)
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                  BACKEND (Node.js + Express)                     │
│  localhost:3001  /  your-backend.railway.app                     │
│                                                                  │
│  timer-service      → 30s countdown broadcaster                  │
│  battle-entry       → participant tracking                       │
│  battle-engine      → winner selection + fight logic             │
│  leaderboard-service→ win tracking across rounds                 │
│  live-purchases     → webhook handler for buy/sell               │
│  reward-service     → direct SOL transfers to winners            │
│  helius.controller  → parses pump.fun on-chain events            │
└──────────────────────────────┬──────────────────────────────────┘
               │               │                │
               ▼               ▼                ▼
    ┌─────────────┐   ┌────────────────┐  ┌──────────────────┐
    │ PostgreSQL  │   │   Solana RPC   │  │  Helius Webhook  │
    │ (Neon.tech) │   │  (devnet/main) │  │  (pump.fun swaps)│
    └─────────────┘   └────────────────┘  └──────────────────┘
```

---

## 4. Project Structure

```
final/
│
├── backend/                         Node.js + TypeScript backend
│   ├── src/
│   │   ├── server.ts                Express + Socket.IO entry point
│   │   ├── config/
│   │   │   ├── database.ts          Prisma client singleton
│   │   │   └── logger.ts            Winston logger
│   │   ├── services/
│   │   │   ├── timer-service.ts     30-second countdown (broadcasts every 1s)
│   │   │   ├── battle-entry.ts      Records participants, enforces uniqueness
│   │   │   ├── battle-engine.ts     Selects winner, drives state machine
│   │   │   ├── leaderboard-service.ts  Win tracking, broadcast updates
│   │   │   ├── live-purchases.ts    Handles buy/sell webhook data
│   │   │   └── reward-service.ts    Direct SOL transfers to top-3 winners
│   │   ├── controllers/
│   │   │   ├── helius.controller.ts Parse & route pump.fun webhook events
│   │   │   ├── webhook.controller.ts Manual/test webhook endpoints
│   │   │   ├── battle.controller.ts HTTP endpoints for battle data
│   │   │   └── leaderboard.controller.ts HTTP endpoints for rankings
│   │   └── ...
│   ├── prisma/
│   │   ├── schema.prisma            Database models
│   │   └── migrations/              Auto-generated migration files
│   ├── .env                         All secrets and configuration
│   └── package.json
│
├── frontend/                        Next.js 14 frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx             Main page layout
│   │   │   ├── layout.tsx           Root HTML + fonts
│   │   │   └── globals.css          Tailwind base + scrollbar styles
│   │   ├── components/
│   │   │   ├── BattleArena.tsx      Fight ring with animated fighters
│   │   │   ├── WalletFeed.tsx       Live entry feed (right panel)
│   │   │   └── Leaderboard.tsx      Top winners grid (bottom section)
│   │   └── hooks/
│   │       └── useBattleSocket.ts   Socket.IO client + all state management
│   └── package.json
│
└── programs/                        Solana Anchor program (optional upgrade)
    └── battle-royale/
        └── src/lib.rs               Rust smart contract (not required for MVP)
```

---

## 5. The Battle Lifecycle

```
IDLE
 │  Admin or auto-start triggers startTimer(roundId)
 ▼
TIMER_ACTIVE  ──── 30 seconds counting down ────
 │  Every 1 second: broadcast "timer-tick" to all clients
 │  Token buys during this window = auto-join
 │  countdown reaches 0
 ▼
TIMER_ENDED
 │  battle-engine.executeBattle() called
 ▼
SELECTING_WINNER
 │  Fetch participants from DB
 │  Get Solana blockhash → derive winnerIndex
 ▼
FIGHTING  ──── 45-second animation plays on frontend ────
 │  "fight-started" event emitted
 │  Wait FIGHT_ANIMATION_DURATION_SECONDS
 ▼
WINNER_REVEAL
 │  "battle-result" event emitted
 │  Leaderboard updated
 │  "leaderboard-update" event emitted
 ▼
COMPLETE
 │  If round < 10: wait 10s → back to TIMER_ACTIVE (next round)
 │  If round == 10: reward distribution → TOURNAMENT_COMPLETE
```

---

## 6. Token Buy → Auto Join

When a user buys your pump.fun token, this exact sequence fires:

```
1. Helius detects SWAP on-chain
2. POST /api/webhooks/helius
   {
     signature: "5xK...",
     feePayer: "BUYER_WALLET",
     tokenTransfers: [{
       mint: "YOUR_TOKEN_MINT",
       toUserAccount: "BUYER_WALLET",   ← non-empty = BUY
       fromUserAccount: "",
       tokenAmount: 1000000,
       decimals: 6
     }]
   }
3. HMAC signature verified against HELIUS_WEBHOOK_SECRET
4. TX verified on Solana RPC (getTransaction → check signer)
5. TokenTransaction row created in DB (idempotent — duplicate TXs ignored)
6. If timer is ACTIVE:
   → Participant row created: { battleId, walletAddress, txSignature }
   → Battle.participantCount incremented
   → Socket.IO emits "participant-joined" to all browsers
   → Fighter dot appears in the ring on every connected browser
```

---

## 7. Token Sell → Kicked Out

```
1. Helius detects SWAP on-chain
2. POST /api/webhooks/helius
   {
     tokenTransfers: [{
       mint: "YOUR_TOKEN_MINT",
       fromUserAccount: "SELLER_WALLET",  ← non-empty = SELL
       toUserAccount: "",
       tokenAmount: 1000000
     }]
   }
3. Character record marked isActive = false, destroyedAt = NOW()
4. Participant removed from active battle DB row
5. Socket.IO emits "character-destroyed" and "participant-removed"
6. Fighter dot disappears from the arena on all browsers
```

---

## 8. Reward Distribution (No Contract)

No Solana smart contract is deployed. Rewards are plain SOL transfers.

```
After round 10:

1. Query leaderboard ORDER BY wins DESC LIMIT 3
2. Load prize wallet from PRIZE_WALLET_PRIVATE_KEY
3. Check balance — keep 0.01 SOL for TX fees
4. Send 3 transactions:

   TX 1: prize_wallet → winner1   (50% of balance)
   TX 2: prize_wallet → winner2   (30% of balance)
   TX 3: prize_wallet → winner3   (20% of balance)

5. Each TX signature logged to Reward table in DB
6. Socket.IO emits "rewards-distributed" with all 3 TX signatures
7. Frontend shows Explorer links so everyone can verify
```

**Split example** — 1 SOL in prize wallet:
| Place | Wallet       | Amount  |
|-------|--------------|---------|
| 1st   | top winner   | 0.50 SOL |
| 2nd   | 2nd winner   | 0.30 SOL |
| 3rd   | 3rd winner   | 0.20 SOL |

---

## 9. Frontend UI

**URL:** `http://localhost:4000` (dev) / `https://yourapp.vercel.app` (prod)

### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  PUMPED OUT BATTLE                               [ LIVE ARENA ]  │ ← Header
├────────────────────────────────┬─────────────────────────────────┤
│                                │  ● Live Entries                 │
│        BATTLE ARENA            │  ─────────────────────          │
│                                │  Abc1...xyz4   +1,000 tokens    │
│  Round: 3          Timer: 18s  │  Def2...uvw5   +500  tokens     │
│                                │  Ghi3...rst6   +250  tokens     │
│    ┌────────────────────┐      │  ...                            │
│    │  ╔══════════════╗  │      │                                 │
│    │  ║  •abc...xyz4 ║  │      │  (scrollable feed of all        │
│    │  ║  • def...uvw ║  │      │   new entries live)             │
│    │  ║ •  •  •   •  ║  │      │                                 │
│    │  ╚══════════════╝  │      │                                 │
│    └────────────────────┘      │                                 │
│         5 Fighters             │                                 │
├────────────────────────────────┴─────────────────────────────────┤
│              CHAMPIONS LEADERBOARD                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ 🥇 abc...xyz │  │ 🥈 def...uvw │  │ 🥉 ghi...rst │           │
│  │   5 Wins     │  │   3 Wins     │  │   2 Wins     │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└──────────────────────────────────────────────────────────────────┘
```

### Components

| Component | File | Purpose |
|---|---|---|
| Battle Arena | `BattleArena.tsx` | Circle ring with animated fighter dots + wallet labels |
| Wallet Feed | `WalletFeed.tsx` | Right panel — scrollable live entry stream |
| Leaderboard | `Leaderboard.tsx` | Bottom grid — top 3 highlighted in white/black |

### State Hook

`useBattleSocket.ts` manages all real-time state:
- Connects to `NEXT_PUBLIC_SOCKET_URL` on mount
- Listens to all Socket.IO events
- Returns: `{ countdown, round, isActive, participants, fightStatus, winner, livePurchases, leaderboard }`

---

## 10. Real-Time Events (Socket.IO)

### Server → All Browsers

| Event | When | Payload |
|---|---|---|
| `timer-tick` | Every 1 second | `{ countdown, round, status, participantCount }` |
| `timer-end` | Countdown hits 0 | `{ round }` |
| `participant-joined` | Token bought during window | `{ count, walletAddress, tokenAmount }` |
| `participant-removed` | Token sold | `{ walletAddress, reason }` |
| `fight-started` | Battle begins | `{ roundId, participantCount, duration }` |
| `battle-result` | Winner decided | `{ roundId, winner, participantCount }` |
| `leaderboard-update` | After each battle | `[{ walletAddress, wins, rank }]` |
| `live-purchase` | Any token buy | `{ buyer, amount, timestamp }` |
| `character-destroyed` | Token sold | `{ walletAddress, characterCount }` |
| `rewards-distributed` | Tournament ends | `{ winners, transactions, isMock }` |
| `tournament-complete` | After round 10 | `{ winners: [{ walletAddress, wins }] }` |

---

## 11. API Reference

### Health
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Server status check |

### Timer
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/timer/state` | Current countdown + round info |

### Battles
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/battles/current` | Current round, timer, participants |
| GET | `/api/battles/history` | Completed battles (paginated) |
| GET | `/api/battles/stats` | Total battles, participants, uniques |
| GET | `/api/battles/:roundId` | Specific round details |

### Leaderboard
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/leaderboard` | Top rankings |
| GET | `/api/leaderboard/top3` | Top 3 winner addresses |
| GET | `/api/leaderboard/:wallet` | Rank for a specific wallet |

### Webhooks
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/webhooks/helius` | **Primary** — pump.fun buy/sell auto-detection |
| POST | `/api/webhooks/token-purchase` | Manual fallback / testing |
| POST | `/api/webhooks/token-sell` | Manual fallback / testing |

### Admin
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/admin/start-round` | Manually start a round |
| POST | `/api/admin/reset-tournament` | Reset leaderboard + rounds |

---

## 12. Database Schema

```prisma
model Battle {
  id               String       @id @default(uuid())
  roundId          Int          @unique
  status           BattleStatus
  winnerId         String?
  winnerAddress    String?
  participantCount Int          @default(0)
  startedAt        DateTime?
  completedAt      DateTime?
  participants     Participant[]
}

model Participant {
  id            String   @id @default(uuid())
  battleId      String
  walletAddress String
  txSignature   String   @unique   ← proof of token purchase
  tokenAmount   Float
  joinedAt      DateTime
  battle        Battle   @relation(...)

  @@unique([battleId, walletAddress])   ← one entry per wallet per round
}

model Character {
  id            String    @id
  walletAddress String
  characterType String    ← "Common" | "Rare" | "Legendary"
  isActive      Boolean
  destroyedAt   DateTime? ← set when user sells tokens
}

model Leaderboard {
  id            String    @id
  walletAddress String    @unique
  wins          Int       @default(0)
  lastWinAt     DateTime?
}

model Reward {
  id              String    @id
  txSignature     String    @unique   ← Solana TX for first-place payment
  winners         String[]            ← [1st, 2nd, 3rd] wallet addresses
  amountPerWinner String              ← in SOL
  distributedAt   DateTime
}

model TokenTransaction {
  id            String              @id
  walletAddress String
  txSignature   String              @unique
  type          PURCHASE | SELL
  tokenAmount   Float
  timestamp     DateTime
  processed     Boolean
}
```

---

## 13. Environment Variables

**File:** `backend/.env`

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | Yes | `development` or `production` |
| `PORT` | Yes | Backend port (default `3001`) |
| `DATABASE_URL` | Yes | PostgreSQL connection string (Neon.tech) |
| `SOLANA_NETWORK` | Yes | `devnet` or `mainnet-beta` |
| `SOLANA_RPC_URL` | Yes | Solana RPC endpoint |
| `PRIZE_WALLET_PRIVATE_KEY` | Yes | Base58 private key of prize wallet |
| `SPL_TOKEN_MINT` | Yes | Your pump.fun token's mint address |
| `HELIUS_WEBHOOK_SECRET` | Yes | From Helius dashboard — validates incoming webhooks |
| `CORS_ORIGIN` | Yes | Frontend URL (e.g. `http://localhost:4000`) |
| `ROUND_DURATION_SECONDS` | No | Countdown length (default `30`) |
| `TOTAL_ROUNDS` | No | Rounds per tournament (default `10`) |
| `FIGHT_ANIMATION_DURATION_SECONDS` | No | Fight animation length (default `45`) |

**File:** `frontend/.env.local`

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SOCKET_URL` | Backend URL (default `http://localhost:3001`) |

---

## 14. Setup Guide — Step by Step

### Step 1 — Create your token on pump.fun

> No coding. Takes 2 minutes.

1. Go to [pump.fun](https://pump.fun)
2. Click **Create a Coin**
3. Fill in: name, ticker, description, image
4. Click **Launch**
5. Copy the mint address from the URL → save it as `SPL_TOKEN_MINT`

---

### Step 2 — Set up Helius Webhook

> Detects every buy/sell of your token automatically.

1. Sign up free at [dev.helius.xyz](https://dev.helius.xyz)
2. Go to **Webhooks → New Webhook**
3. Set:
   - **URL:** `https://your-backend.railway.app/api/webhooks/helius`
   - **Transaction Types:** `SWAP`
   - **Account Filter:** paste your `SPL_TOKEN_MINT`
4. Copy the **webhook secret** → save as `HELIUS_WEBHOOK_SECRET`

---

### Step 3 — Create and fund the prize wallet

```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Generate a new prize wallet
solana-keygen new --outfile prize-wallet.json

# Get the public address
solana-keygen pubkey prize-wallet.json

# Get base58 private key (copy this to .env)
node -e "
  const bs58 = require('bs58');
  const key = require('./prize-wallet.json');
  console.log(bs58.encode(Buffer.from(key)));
"

# Fund on devnet (for testing)
solana airdrop 2 <PRIZE_WALLET_PUBKEY> --url devnet

# Fund on mainnet — just send SOL to the address
```

---

### Step 4 — Configure backend

```bash
cd backend

# Copy and edit the env file
cp .env.example .env
```

Edit `.env`:
```env
PRIZE_WALLET_PRIVATE_KEY=<your_base58_key>
SPL_TOKEN_MINT=<your_token_mint_address>
HELIUS_WEBHOOK_SECRET=<from_helius_dashboard>
CORS_ORIGIN=http://localhost:4000
```

---

### Step 5 — Run the backend

```bash
cd backend
npm install
npx prisma migrate deploy
npx prisma generate
npm run dev
# → Running on http://localhost:3001
```

---

### Step 6 — Run the frontend

```bash
cd frontend
npm install
npm run build
npx next start -p 4000
# → Open http://localhost:4000
```

Or for development with hot-reload:
```bash
npm run dev
# → http://localhost:3000
```

---

## 15. Deployment

### Backend → Railway (free tier)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up

# Set environment variables in Railway dashboard
# or via CLI:
railway env set DATABASE_URL=...
railway env set PRIZE_WALLET_PRIVATE_KEY=...
railway env set SPL_TOKEN_MINT=...
railway env set HELIUS_WEBHOOK_SECRET=...
railway env set CORS_ORIGIN=https://your-frontend.vercel.app
railway env set NODE_ENV=production
```

After deploy, copy the Railway URL and:
1. Update Helius webhook URL to `https://your-railway-url.railway.app/api/webhooks/helius`
2. Update `NEXT_PUBLIC_SOCKET_URL` in frontend

---

### Frontend → Vercel (free tier)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy from frontend directory
cd frontend
vercel --prod
```

Set environment variable in Vercel dashboard:
```
NEXT_PUBLIC_SOCKET_URL = https://your-backend.railway.app
```

---

### Database → Neon.tech (already configured)

The `DATABASE_URL` in `.env` points to a live Neon PostgreSQL instance. Migrations are already applied. No action needed.

---

## Quick Reference — Running Locally

```bash
# Terminal 1 — Backend
cd final/backend
npm run dev
# http://localhost:3001

# Terminal 2 — Frontend
cd final/frontend
npx next start -p 4000
# http://localhost:4000

# Test the system (simulate a token purchase)
curl -X POST http://localhost:3001/api/webhooks/token-purchase \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "AbcDef1234567890AbcDef1234567890AbcDef12",
    "txSignature": "test_sig_001",
    "tokenAmount": 1000
  }'

# Check health
curl http://localhost:3001/api/health

# Check current battle state
curl http://localhost:3001/api/battles/current

# Check leaderboard
curl http://localhost:3001/api/leaderboard
```

---

*Built with Node.js · TypeScript · Next.js 14 · Socket.IO · Prisma · PostgreSQL · Solana · pump.fun · Helius*
# this_is_the_end
