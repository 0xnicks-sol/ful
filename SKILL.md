# SKILL.md — Real-Time Token Battle System (Solana)

## 🎯 Overview

This skill enables the agent to build and maintain a **real-time token battle platform on Solana** where participants enter rounds by purchasing tokens. A **30-second battle window** allows users to join. After the timer ends, a **provably fair winner is selected using Switchboard VRF**, an animated fight sequence plays, and **leaderboards update across multiple rounds**. At the end of the tournament (8-10 rounds), rewards are **distributed automatically using a Solana Anchor smart contract**.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│  Next.js Frontend (Vercel)                                       │
│  ├─ PlaygroundTimer.tsx       (30s countdown display)           │
│  ├─ BattleArena.tsx           (animated fight)                  │
│  ├─ Leaderboard.tsx           (live rankings)                   │
│  ├─ JoinBattleButton.tsx      (participation CTA)               │
│  └─ useBattleSocket.ts        (Socket.IO client hook)           │
└─────────────────────────────────────────────────────────────────┘
                              ↕ Socket.IO (WebSocket)
┌─────────────────────────────────────────────────────────────────┐
│                      REALTIME LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  Socket.IO Server (Railway/Render)                              │
│  ├─ timer-tick (every 1s)                                       │
│  ├─ participant-joined                                          │
│  ├─ fight-started                                               │
│  ├─ battle-result                                               │
│  └─ leaderboard-update                                          │
└─────────────────────────────────────────────────────────────────┘
                              ↕ HTTP / WebSocket
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│  Node.js + TypeScript + Express                                 │
│  ├─ timer-service.ts          (30s countdown broadcaster)       │
│  ├─ battle-entry.ts           (track participants)              │
│  ├─ battle-engine.ts          (winner selection)                │
│  ├─ leaderboard-service.ts    (win tracking)                    │
│  ├─ reward-service.ts         (Solana integration)              │
│  └─ live-purchases.ts         (webhook handler)                 │
└─────────────────────────────────────────────────────────────────┘
                              ↕ SQL / NoSQL
┌─────────────────────────────────────────────────────────────────┐
│                      DATABASE LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL / MongoDB                                            │
│  ├─ battles                   (round records)                   │
│  ├─ participants              (entries per round)               │
│  ├─ leaderboard               (win counts)                      │
│  └─ rewards                   (distribution logs)               │
└─────────────────────────────────────────────────────────────────┘
                              ↕ @solana/web3.js
┌─────────────────────────────────────────────────────────────────┐
│                      BLOCKCHAIN LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  Solana Mainnet / Devnet                                         │
│  ├─ Reward Distributor Program (Rust/Anchor)                    │
│  ├─ Switchboard VRF Oracle (randomness)                         │
│  └─ SPL Token Program (token purchases)                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14 + TypeScript | React framework with App Router |
| **Styling** | Tailwind CSS + Framer Motion | UI components + animations |
| **Realtime** | Socket.IO Client | WebSocket connection to backend |
| **Wallet** | @solana/wallet-adapter-react | Phantom/Solflare integration |
| **Blockchain** | @solana/web3.js | Solana transactions |
| **Backend** | Node.js + Express + TypeScript | API server |
| **Realtime Server** | Socket.IO Server | WebSocket broadcaster |
| **Database** | PostgreSQL + Prisma | Relational data storage |
| **Smart Contract** | Rust + Anchor Framework | Solana program |
| **Randomness** | Switchboard VRF | Provably fair randomness |
| **Hosting (Frontend)** | Vercel | Free tier, auto-deploy |
| **Hosting (Backend)** | Railway / Render | Free tier, WebSocket support |
| **Database Hosting** | Supabase / Railway | Free PostgreSQL |

---

## 🗂️ Complete Folder Structure

```
pumped-out-fund/
│
├── backend/                           # Node.js backend service
│   ├── src/
│   │   ├── server.ts                  # Express + Socket.IO entry point
│   │   ├── config/
│   │   │   ├── database.ts            # Prisma client initialization
│   │   │   ├── solana.ts              # Solana connection + wallet
│   │   │   └── socket.ts              # Socket.IO configuration
│   │   ├── services/
│   │   │   ├── timer-service.ts       # 30-second countdown logic
│   │   │   ├── battle-entry.ts        # Participation tracking
│   │   │   ├── battle-engine.ts       # Winner selection + VRF
│   │   │   ├── leaderboard-service.ts # Win tracking across rounds
│   │   │   ├── reward-service.ts      # Solana reward distribution
│   │   │   └── live-purchases.ts      # Token purchase webhook
│   │   ├── controllers/
│   │   │   ├── battle.controller.ts   # Battle HTTP endpoints
│   │   │   └── leaderboard.controller.ts # Leaderboard API
│   │   ├── models/
│   │   │   ├── Battle.ts              # Battle round model
│   │   │   ├── Participant.ts         # Participant model
│   │   │   ├── Leaderboard.ts         # Leaderboard entry model
│   │   │   └── Reward.ts              # Reward distribution log
│   │   ├── utils/
│   │   │   ├── switchboard-vrf.ts     # VRF randomness integration
│   │   │   ├── wallet-verifier.ts     # Solana signature verification
│   │   │   └── logger.ts              # Winston logger
│   │   ├── socket/
│   │   │   ├── events.ts              # Socket event type definitions
│   │   │   └── handlers.ts            # Socket event handlers
│   │   └── middleware/
│   │       ├── auth.ts                # JWT authentication
│   │       └── rateLimit.ts           # Rate limiting
│   ├── prisma/
│   │   └── schema.prisma              # Database schema
│   ├── tests/
│   │   ├── timer.test.ts
│   │   ├── battle-engine.test.ts
│   │   └── reward-distribution.test.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
│
├── programs/                          # Solana Anchor programs
│   └── reward-distributor/
│       ├── src/
│       │   └── lib.rs                 # Rust smart contract
│       ├── tests/
│       │   └── reward-distributor.ts  # Anchor tests
│       ├── Cargo.toml
│       └── Anchor.toml
│
├── frontend/                          # Next.js frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx             # Root layout
│   │   │   ├── page.tsx               # Home page
│   │   │   ├── playground/
│   │   │   │   └── page.tsx           # Battle arena page
│   │   │   ├── leaderboard/
│   │   │   │   └── page.tsx           # Leaderboard page
│   │   │   └── api/
│   │   │       └── proxy/[...path].ts # API proxy routes
│   │   ├── components/
│   │   │   ├── Playground/
│   │   │   │   ├── PlaygroundTimer.tsx       # Countdown display
│   │   │   │   ├── BattleArena.tsx           # Fight animation
│   │   │   │   ├── ParticipantList.tsx       # Live participant count
│   │   │   │   ├── TokenPurchasePrompt.tsx   # Prompt to buy tokens (replaces JoinBattleButton)
│   │   │   │   └── LivePurchaseFeed.tsx      # Token buy/sell stream
│   │   │   ├── Leaderboard/
│   │   │   │   ├── Leaderboard.tsx           # Rankings display
│   │   │   │   ├── RankingCard.tsx           # Individual rank
│   │   │   │   └── WinnerBadge.tsx           # Top 3 badges
│   │   │   ├── Wallet/
│   │   │   │   ├── WalletConnect.tsx         # Wallet button
│   │   │   │   └── WalletInfo.tsx            # Display wallet
│   │   │   └── UI/
│   │   │       ├── Button.tsx
│   │   │       ├── Card.tsx
│   │   │       └── Modal.tsx
│   │   ├── hooks/
│   │   │   ├── useBattleSocket.ts     # Socket.IO state management
│   │   │   ├── useWallet.ts           # Wallet connection logic
│   │   │   ├── useLeaderboard.ts      # Leaderboard state
│   │   │   └── useTimer.ts            # Timer state
│   │   ├── store/
│   │   │   ├── battleStore.ts         # Zustand battle state
│   │   │   ├── walletStore.ts         # Wallet state
│   │   │   └── leaderboardStore.ts    # Leaderboard state
│   │   ├── lib/
│   │   │   ├── socket.ts              # Socket.IO client setup
│   │   │   ├── solana.ts              # Solana connection
│   │   │   ├── anchor-program.ts      # Anchor program interface
│   │   │   └── utils.ts               # Helper functions
│   │   └── types/
│   │       ├── battle.ts              # Battle types
│   │       ├── wallet.ts              # Wallet types
│   │       └── socket.ts              # Socket event types
│   ├── public/
│   │   ├── animations/
│   │   │   └── fight-animation.json   # Lottie animation
│   │   └── images/
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── next.config.js
│
└── README.md
```

---

## 🔄 State Machine: Battle Lifecycle

```
┌──────────────┐
│    IDLE      │ ← System waiting for next round
└──────┬───────┘
       │ Admin/Auto triggers startRound()
       ↓
┌──────────────┐
│ TIMER_ACTIVE │ ← 30-second window open
│   (30s)      │   Users can join battle
└──────┬───────┘
       │ countdown === 0
       ↓
┌──────────────┐
│ TIMER_ENDED  │ ← No more entries accepted
└──────┬───────┘
       │ trigger selectWinner()
       ↓
┌──────────────┐
│  SELECTING   │ ← Calling Switchboard VRF
│   WINNER     │   Random selection in progress
└──────┬───────┘
       │ VRF callback received
       ↓
┌──────────────┐
│   FIGHTING   │ ← Animated battle playing
│  (30-60s)    │   Visual entertainment
└──────┬───────┘
       │ animation complete
       ↓
┌──────────────┐
│WINNER_REVEAL │ ← Show winner + update leaderboard
└──────┬───────┘
       │
       ├─ If roundCount < 10 → Loop back to IDLE
       │
       └─ If roundCount === 10 → GO TO REWARD_DISTRIBUTION
                                   ↓
                          ┌────────────────┐
                          │    REWARDS     │
                          │  DISTRIBUTING  │
                          └────────┬───────┘
                                   │
                          ┌────────────────┐
                          │   TOURNAMENT   │
                          │    COMPLETE    │
                          └────────────────┘
```

---

## 📊 Database Schema (Prisma)

### `prisma/schema.prisma`

```prisma
// Battle rounds
model Battle {
  id               String        @id @default(uuid())
  roundId          Int           @unique
  status           BattleStatus  @default(IDLE)
  winnerId         String?
  winnerAddress    String?
  participantCount Int           @default(0)
  startedAt        DateTime?
  completedAt      DateTime?
  createdAt        DateTime      @default(now())
  participants     Participant[]
  
  @@index([roundId])
  @@index([status])
}

enum BattleStatus {
  IDLE
  TIMER_ACTIVE
  TIMER_ENDED
  SELECTING_WINNER
  FIGHTING
  WINNER_REVEAL
  COMPLETE
}

// Battle participants
model Participant {
  id            String   @id @default(uuid())
  battleId      String
  walletAddress String
  txSignature   String?  // Solana transaction signature
  joinedAt      DateTime @default(now())
  
  battle        Battle   @relation(fields: [battleId], references: [id])
  
  @@unique([battleId, walletAddress])
  @@index([battleId])
  @@index([walletAddress])
}

// Leaderboard tracking
model Leaderboard {
  id            String   @id @default(uuid())
  walletAddress String   @unique
  wins          Int      @default(0)
  lastWinAt     DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([wins, lastWinAt])
}

// Reward distribution logs
model Reward {
  id              String   @id @default(uuid())
  txSignature     String   @unique  // Solana transaction signature
  winners         String[] // Array of 3 wallet addresses
  amountPerWinner String   // Amount in SOL (stored as string)
  distributedAt   DateTime @default(now())
  
  @@index([distributedAt])
}
```

---

## 🔌 Socket.IO Event Schema

### Client → Server Events

```typescript
// Join battle event
interface JoinBattlePayload {
  walletAddress: string;      // Solana wallet address (base58)
  signature?: string;          // Optional signature for verification
  timestamp: number;
}

socket.emit('join-battle', payload, (response) => {
  // response: { success: boolean, error?: string }
});
```

### Server → Client Events

```typescript
// Timer tick (every 1 second)
interface TimerTickPayload {
  countdown: number;           // Seconds remaining (30 → 0)
  round: number;               // Current round (1-10)
  status: 'active' | 'ended';
  participantCount: number;
}
socket.on('timer-tick', (data: TimerTickPayload) => { ... });

// Participant joined
interface ParticipantJoinedPayload {
  count: number;
  walletAddress: string;       // Truncated for privacy
}
socket.on('participant-joined', (data: ParticipantJoinedPayload) => { ... });

// Fight started
interface FightStartedPayload {
  roundId: number;
  participantCount: number;
  duration: number;            // Animation duration in seconds
}
socket.on('fight-started', (data: FightStartedPayload) => { ... });

// Battle result
interface BattleResultPayload {
  roundId: number;
  winner: string;              // Full Solana address
  participantCount: number;
}
socket.on('battle-result', (data: BattleResultPayload) => { ... });

// Leaderboard update
interface LeaderboardEntry {
  walletAddress: string;
  wins: number;
}
socket.on('leaderboard-update', (data: LeaderboardEntry[]) => { ... });

// Rewards distributed
interface RewardsDistributedPayload {
  winners: string[];           // Top 3 wallet addresses
  amountPerWinner: string;     // SOL amount (e.g., "0.5")
  txSignature: string;         // Solana transaction signature
}
socket.on('rewards-distributed', (data: RewardsDistributedPayload) => { ... });

// Live token purchase
interface LivePurchasePayload {
  buyer: string;               // Truncated wallet
  amount: number;              // Token amount
  timestamp: Date;
}
socket.on('live-purchase', (data: LivePurchasePayload) => { ... });
```

---

## 🎮 Module 1: Real-Time Timer System

### Backend Implementation

**File:** `backend/src/services/timer-service.ts`

**Responsibilities:**
- Maintain 30-second countdown
- Broadcast updates to all clients via Socket.IO
- Transition battle state machine

**Core Functions:**

```typescript
class TimerService {
  startTimer(io: SocketIO.Server, roundId: number): void
  stopTimer(): void
  getRemainingTime(): number
  isActive(): boolean
  getCurrentRound(): number
}
```

**State Transitions:**
```
startTimer() → TIMER_ACTIVE
countdown === 0 → TIMER_ENDED
```

**Broadcast Events:**
- `timer-tick` (every 1 second)
- `timer-end` (countdown reaches 0)
- `next-round-starting` (after 10 second break)

**Database Updates:**
```sql
UPDATE battles 
SET status = 'TIMER_ACTIVE', startedAt = NOW() 
WHERE roundId = ?
```

---

### Frontend Implementation

**File:** `frontend/src/components/Playground/PlaygroundTimer.tsx`

**Responsibilities:**
- Display circular countdown timer
- Show current round number
- Visual effects when time running out

**Socket Integration:**
```typescript
const { countdown, round, isActive } = useBattleSocket();
```

**UI States:**
- `countdown > 10` → Green circle (safe time)
- `countdown <= 10` → Red circle (urgent)
- `countdown === 0` → Gray (ended)

**Animation:**
- Pulse effect on Join button when active
- Number scale animation on each tick
- Progress ring SVG animation

---

## 🎯 Module 2: Battle Entry & Participation (Token Purchase Required)

### Backend Implementation

**File:** `backend/src/services/battle-entry.ts`

**CRITICAL RULE:** Token purchase during 30s window = Automatic battle entry

**Responsibilities:**
- Receive token purchase webhooks
- Verify Solana transactions on-chain
- Auto-record participants (NO manual join button)
- Detect token sells and destroy characters
- Prevent duplicate entries per round
- Broadcast participant count

**Core Functions:**

```typescript
class BattleEntryService {
  async recordParticipation(
    walletAddress: string,
    txSignature: string,
    roundId: number
  ): Promise<boolean>
  
  getParticipants(roundId: number): Promise<Participant[]>
  
  clearParticipants(roundId: number): void
  
  hasJoined(walletAddress: string, roundId: number): Promise<boolean>
  
  async removeParticipant(walletAddress: string): Promise<void>
  
  async handleTokenSell(walletAddress: string, txSignature: string): Promise<void>
}
```

**Purchase Validation Flow (Auto-Join):**
```
Webhook: /api/webhooks/token-purchase
↓
1. Verify transaction on Solana blockchain
2. Check if timer is active → reject if not
3. Check duplicate entry → skip if already joined
4. Insert into database → participants table with txSignature
5. Assign character NFT to wallet
6. Broadcast participant-joined event
```

**Token Sell Detection Flow:**
```
Webhook: /api/webhooks/token-sell
↓
1. Verify sell transaction on Solana
2. Find all characters owned by wallet
3. Mark characters as destroyed (destroyedAt = NOW())
4. Remove from active battle participants
5. Broadcast character-destroyed event
```

**Database Query (Auto-Join):**
```sql
INSERT INTO participants (battleId, walletAddress, txSignature, joinedAt)
VALUES (?, ?, ?, NOW())
ON CONFLICT (battleId, walletAddress) DO NOTHING
```

**Database Query (Character Destruction):**
```sql
UPDATE characters 
SET destroyedAt = NOW(), isActive = false 
WHERE walletAddress = ? AND isActive = true
```

**Solana Transaction Verification:**
```typescript
import { Connection, PublicKey } from '@solana/web3.js';

async function verifyTokenPurchase(
  txSignature: string,
  expectedBuyer: string
): Promise<boolean> {
  const connection = new Connection(process.env.SOLANA_RPC_URL!);
  
  const tx = await connection.getTransaction(txSignature, {
    commitment: 'confirmed'
  });
  
  if (!tx) return false;
  
  // Verify signer matches buyer
  const signer = tx.transaction.message.accountKeys[0].toBase58();
  if (signer !== expectedBuyer) return false;
  
  // Verify token program interaction
  const tokenProgramId = new PublicKey(process.env.TOKEN_PROGRAM_ID!);
  const hasTokenTransfer = tx.transaction.message.accountKeys.some(
    key => key.equals(tokenProgramId)
  );
  
  return hasTokenTransfer;
}
```

---

### Frontend Implementation

**File:** `frontend/src/components/Playground/JoinBattleButton.tsx`

**Responsibilities:**
- Connect wallet if not connected
- Sign message with wallet
- Send join request to backend
- Handle success/error states

**Flow:**
```
User clicks "Join Battle"
  ↓
Check wallet connected → If not, trigger wallet connect modal
  ↓
Sign message: "Join Battle Round {roundId}"
  ↓
Send to backend via Socket.IO
  ↓
Wait for confirmation
  ↓
Show success toast + disable button
```

**Socket Emit:**
```typescript
await socket.emit('join-battle', {
  walletAddress: wallet.publicKey.toBase58(),
  signature: signatureBase58,
  timestamp: Date.now()
});
```

---

## 🎲 Module 3: Provably Fair Winner Selection

### Backend Implementation

**File:** `backend/src/services/battle-engine.ts`

**Responsibilities:**
- Select winner using Switchboard VRF
- Trigger fight animation
- Update leaderboard
- Advance to next round or distribute rewards

**Core Functions:**

```typescript
class BattleEngine {
  async selectWinner(participants: Participant[]): Promise<Participant>
  
  async executeBattle(io: SocketIO.Server, roundId: number): Promise<void>
  
  async triggerRewardDistribution(io: SocketIO.Server): Promise<void>
}
```

**Winner Selection with Switchboard VRF:**

```typescript
import * as anchor from '@project-serum/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { OracleJob, createFeed } from '@switchboard-xyz/solana.js';

async function getVerifiableRandom(): Promise<number> {
  const connection = new Connection(process.env.SOLANA_RPC_URL!);
  
  // Request randomness from Switchboard Oracle
  const vrfAccount = new PublicKey(process.env.SWITCHBOARD_VRF_ACCOUNT!);
  
  // Fetch VRF result
  const vrfState = await program.account.vrf.fetch(vrfAccount);
  
  // Convert to number
  const randomBytes = vrfState.result.value;
  const randomNumber = Buffer.from(randomBytes).readUInt32BE(0);
  
  return randomNumber;
}
```

**Fallback Randomness (for testing):**
```typescript
function getSimpleRandom(): number {
  return Math.floor(Math.random() * 1000000);
}
```

**State Machine Flow:**
```
TIMER_ENDED
  ↓
executeBattle() called
  ↓
UPDATE battles SET status = 'SELECTING_WINNER'
  ↓
Request Switchboard VRF
  ↓
Receive random number
  ↓
Calculate: winnerIndex = randomNumber % participants.length
  ↓
UPDATE battles SET status = 'FIGHTING', winnerId = ?
  ↓
EMIT 'fight-started'
  ↓
Sleep 45 seconds (animation duration)
  ↓
UPDATE battles SET status = 'WINNER_REVEAL', completedAt = NOW()
  ↓
EMIT 'battle-result'
  ↓
UPDATE leaderboard: wins = wins + 1
  ↓
EMIT 'leaderboard-update'
  ↓
Check if roundId === 10
  ↓ YES
triggerRewardDistribution()
  ↓ NO
Wait 10 seconds → startTimer(roundId + 1)
```

---

## 🏆 Module 4: Leaderboard & Round Management

### Backend Implementation

**File:** `backend/src/services/leaderboard-service.ts`

**Responsibilities:**
- Track wins across all rounds
- Calculate rankings
- Identify top 3 for rewards
- Reset leaderboard after tournament

**Core Functions:**

```typescript
class LeaderboardService {
  async recordWin(walletAddress: string): Promise<void>
  
  async getTopRankings(limit: number = 10): Promise<LeaderboardEntry[]>
  
  async getTop3Winners(): Promise<string[]>
  
  async resetLeaderboard(): Promise<void>
}
```

**Database Operations:**

```sql
-- Record win
INSERT INTO leaderboard (walletAddress, wins, lastWinAt)
VALUES (?, 1, NOW())
ON CONFLICT (walletAddress)
DO UPDATE SET 
  wins = leaderboard.wins + 1,
  lastWinAt = NOW()

-- Get top rankings
SELECT walletAddress, wins
FROM leaderboard
ORDER BY wins DESC, lastWinAt ASC
LIMIT ?

-- Get top 3
SELECT walletAddress
FROM leaderboard
ORDER BY wins DESC, lastWinAt ASC
LIMIT 3
```

**Broadcasting:**
```typescript
// After each battle
const top10 = await leaderboardService.getTopRankings(10);
io.emit('leaderboard-update', top10);
```

---

### Frontend Implementation

**File:** `frontend/src/components/Leaderboard/Leaderboard.tsx`

**Responsibilities:**
- Display live rankings
- Highlight top 3 winners
- Show win counts
- Auto-update on socket events

**Socket Integration:**
```typescript
useEffect(() => {
  socket.on('leaderboard-update', (data) => {
    setRankings(data);
  });
}, []);
```

**UI Styling:**
- Rank 1: Gold border + 🥇 emoji
- Rank 2: Silver border + 🥈 emoji
- Rank 3: Bronze border + 🥉 emoji
- Rank 4+: Gray border + #N rank

---

## 💰 Module 5: Smart Contract Reward Distribution

### Solana Anchor Program

**File:** `programs/reward-distributor/src/lib.rs`

**Program Instructions:**

1. **Initialize** - Create reward pool PDA
2. **Deposit Rewards** - Add SOL to pool
3. **Distribute Rewards** - Send 50% to top 3 winners

**Key Features:**
- Uses Program Derived Address (PDA) for reward storage
- Validates exactly 3 winners
- Splits 50% of pool equally among top 3
- Emits event for transparency

**Security Checks:**
- Authority validation
- Balance verification
- Reentrancy protection (Anchor handles this)

---

### Backend Reward Service

**File:** `backend/src/services/reward-service.ts`

**Responsibilities:**
- Call Anchor program
- Verify transactions
- Log distribution to database
- Broadcast success to clients

**Core Function:**

```typescript
async distributeRewards(top3Addresses: string[]) {
  // 1. Get top 3 from leaderboard
  const winners = await leaderboardService.getTop3Winners();
  
  // 2. Convert to Solana PublicKeys
  const winnerPubkeys = winners.map(addr => new PublicKey(addr));
  
  // 3. Call Anchor program
  const tx = await program.methods
    .distributeRewards(winnerPubkeys)
    .accounts({ ... })
    .rpc();
  
  // 4. Wait for confirmation
  await connection.confirmTransaction(tx, 'confirmed');
  
  // 5. Log to database
  await Reward.create({ ... });
  
  // 6. Broadcast to clients
  io.emit('rewards-distributed', { ... });
}
```

**Transaction Explorer Link:**
```
https://explorer.solana.com/tx/{txSignature}?cluster=mainnet
```

---

## 🔗 Module 6: Live Purchase API Integration

### Backend Webhook Handler

**File:** `backend/src/services/live-purchases.ts`

**Responsibilities:**
- Receive token purchase webhooks
- Verify transaction on Solana
- Auto-join user to active battle
- Broadcast purchase to frontend

**Webhook Endpoint:**
```typescript
POST /api/webhooks/token-purchase

Body:
{
  walletAddress: string,
  txSignature: string,
  tokenAmount: number,
  timestamp: string
}
```

**Verification Flow:**
```
1. Verify transaction exists on Solana
2. Check transaction is recent (< 60 seconds old)
3. Verify wallet is sender
4. Check if timer is currently active
5. Auto-join battle if active
6. Broadcast live-purchase event
```

**Solana Transaction Verification:**
```typescript
import { Connection } from '@solana/web3.js';

async function verifyTransaction(
  signature: string,
  expectedSigner: string
): Promise<boolean> {
  const connection = new Connection(process.env.SOLANA_RPC_URL!);
  
  const tx = await connection.getTransaction(signature, {
    commitment: 'confirmed'
  });
  
  if (!tx) return false;
  
  // Verify signer matches
  const signer = tx.transaction.message.accountKeys[0].toBase58();
  return signer === expectedSigner;
}
```

---

## 🎬 Module 7: Battle Animation System

### Frontend Implementation

**File:** `frontend/src/components/Playground/BattleArena.tsx`

**Animation Options:**

1. **Lottie JSON Animation** (recommended for MVP)
   - Pre-made fight animation
   - Smooth, performant
   - Easy to replace

2. **Framer Motion Custom Animation**
   - Two character sprites
   - Attack sequences
   - Health bars decreasing
   - Winner celebration

3. **Canvas/WebGL Animation**
   - Most advanced
   - Highest performance
   - Complex implementation

**Animation Flow:**
```
'fight-started' event received
  ↓
Display VS screen (2 seconds)
  ↓
Play fight animation (30-45 seconds)
  ↓
'battle-result' event received
  ↓
Freeze frame on winner
  ↓
Show winner card with confetti (5 seconds)
  ↓
Fade out → Show leaderboard update
```

**States:**
- `idle` - Waiting for battle
- `vs-screen` - Pre-fight display
- `fighting` - Animation playing
- `winner-reveal` - Show result

---

## 🛠️ Module 8: Admin Control Panel

### Backend Admin Endpoints

**File:** `backend/src/controllers/admin.controller.ts`

**Protected Routes (JWT Auth):**

```typescript
POST   /api/admin/start-round       // Manually start new round
POST   /api/admin/stop-round        // Emergency stop current round
POST   /api/admin/reset-tournament  // Clear leaderboard and restart
PATCH  /api/admin/timer-duration    // Change timer length
GET    /api/admin/analytics         // Battle statistics
POST   /api/admin/emergency-pause   // Freeze entire system
```

**Authorization:**
```typescript
middleware: [authenticate, requireAdmin]
```

---

### Frontend Admin Dashboard

**File:** `frontend/src/app/admin/page.tsx`

**Dashboard Sections:**

1. **Round Control**
   - Start Round button
   - Stop Round button
   - Current round status display

2. **Live Stats**
   - Active participants
   - Current round number
   - Timer status
   - Total battles completed

3. **Analytics**
   - Total revenue
   - Average participants per round
   - Most wins (leaderboard)
   - Reward distribution history

4. **Emergency Controls**
   - Emergency Pause (big red button)
   - Resume System
   - Reset Tournament

5. **Logs**
   - Recent battles
   - Recent joins
   - Error logs

---

## 🔐 Security Implementation

### 1. Wallet Signature Verification

**Purpose:** Prevent fake wallet addresses from joining battles

**Implementation:**
```typescript
// Frontend: Sign message
const message = `Join Battle Round ${roundId}`;
const encodedMessage = new TextEncoder().encode(message);
const signature = await wallet.signMessage(encodedMessage);

// Backend: Verify signature
import nacl from 'tweetnacl';
const valid = nacl.sign.detached.verify(
  messageBytes,
  signatureBytes,
  publicKeyBytes
);
```

### 2. Rate Limiting

**Purpose:** Prevent spam join attempts

**Implementation:**
```typescript
import rateLimit from 'express-rate-limit';

const joinBattleLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 5,                // 5 attempts per minute
  message: 'Too many join attempts'
});
```

### 3. Transaction Verification

**Purpose:** Ensure token purchases are real

**Implementation:**
- Verify transaction signature on Solana blockchain
- Check transaction timestamp (prevent replay attacks)
- Verify correct program ID and accounts

### 4. Smart Contract Security

**Anchor Security Features:**
- Constraint checks on accounts
- Signer validation
- PDA derivation verification
- Overflow protection

**Recommended Audit:**
- OtterSec
- Neodyme
- Kudelski Security

---

## 📈 Performance Requirements

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| **Timer Accuracy** | ±200ms | ±500ms |
| **Socket.IO Latency** | <300ms | <1000ms |
| **Winner Selection Time** | <5s | <15s |
| **Database Query Time** | <100ms | <500ms |
| **Page Load Time** | <2s | <5s |
| **Concurrent Users** | 1000+ | 5000+ |
| **API Response Time** | <200ms | <1000ms |

---

## 🚀 Deployment Checklist

### Pre-Deployment

- [ ] Smart contract audited
- [ ] Load testing completed (1000+ concurrent)
- [ ] Database migrations tested
- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Monitoring dashboards set up
- [ ] Backup systems configured
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Error logging (Sentry/LogRocket)

### Deployment Steps

1. **Deploy Smart Contract to Solana Mainnet**
   ```bash
   anchor build
   anchor deploy --provider.cluster mainnet
   ```

2. **Deploy Backend to Railway**
   ```bash
   railway up
   railway env set KEY=VALUE
   ```

3. **Deploy Frontend to Vercel**
   ```bash
   vercel --prod
   ```

4. **Initialize Database**
   ```bash
   npx prisma migrate deploy
   ```

5. **Seed Initial Data**
   ```bash
   npm run seed
   ```

---

## 🧪 Testing Strategy

### Unit Tests
- Timer service countdown logic
- Winner selection algorithm
- Leaderboard ranking calculation
- Signature verification

### Integration Tests
- Full battle lifecycle (30s timer → winner → leaderboard)
- Multi-round tournament completion
- Reward distribution end-to-end

### Load Tests
- 1000 concurrent Socket.IO connections
- 100 simultaneous join requests
- Database query performance under load

### Manual QA
- Different browser testing (Chrome, Firefox, Safari)
- Mobile responsiveness
- Wallet connection (Phantom, Solflare, Backpack)
- Edge cases (0 participants, 1 participant, network disconnection)

---

## 📚 Agent Implementation Order

### Phase 1: Backend Foundation (Days 1-3)
1. Setup Node.js + TypeScript project
2. Configure PostgreSQL + Prisma
3. Build Timer Service
4. Setup Socket.IO server
5. Test timer broadcasts

### Phase 2: Smart Contract (Days 4-6)
1. Initialize Anchor project
2. Build Reward Distributor program
3. Write Anchor tests
4. Deploy to devnet
5. Test from backend

### Phase 3: Battle Logic (Days 7-9)
1. Build Battle Entry Service
2. Implement Battle Engine
3. Integrate Switchboard VRF
4. Build Leaderboard Service
5. Test full battle flow

### Phase 4: Frontend Core (Days 10-12)
1. Setup Next.js project
2. Build Socket.IO hook
3. Create Timer component
4. Create Battle Arena component
5. Wallet integration

### Phase 5: Frontend Features (Days 13-15)
1. Build Leaderboard component
2. Create Join Battle flow
3. Add animations (Framer Motion)
4. Polish UI/UX
5. Mobile responsive design

### Phase 6: Integration (Days 16-18)
1. Connect frontend to backend
2. Test end-to-end flows
3. Fix bugs
4. Performance optimization
5. Security hardening

### Phase 7: Admin & Polish (Days 19-21)
1. Build admin dashboard
2. Add analytics
3. Error handling & logging
4. Documentation
5. Final testing

### Phase 8: Deployment (Days 22-25)
1. Deploy smart contract to mainnet
2. Deploy backend to Railway
3. Deploy frontend to Vercel
4. Configure domains & SSL
5. Monitor & launch

---

## 🎯 Success Criteria

A fully functional battle system where:

✅ Users can join battles during a 30-second window  
✅ Winners are selected fairly using Switchboard VRF  
✅ Animated fights display in browser  
✅ Leaderboards update in real-time  
✅ 10 rounds complete a tournament  
✅ Top 3 winners receive 50% of reward pool automatically  
✅ All participants see synchronized timer  
✅ System handles 1000+ concurrent users  
✅ Smart contract is audited and secure  
✅ Admin can control and monitor system  

---

## 🆘 Common Issues & Solutions

### Issue: Socket.IO disconnections
**Solution:** Implement reconnection logic + heartbeat ping/pong

### Issue: Timer desync across clients
**Solution:** Use server-side timer as source of truth, clients just display

### Issue: VRF request fails
**Solution:** Implement fallback to blockhash-based randomness

### Issue: Database connection pool exhausted
**Solution:** Increase pool size, optimize queries, add connection limits

### Issue: Race condition in participant joins
**Solution:** Use database unique constraint + proper error handling

---

**This skill enables the agent to build a production-ready, provably fair, real-time battle system on Solana from scratch.** 🚀
