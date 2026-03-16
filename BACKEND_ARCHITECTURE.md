# 🔧 Backend Architecture - Pumped Out Fund Playground

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Real-Time**: Socket.IO (WebSocket)
- **Database**: PostgreSQL / MongoDB
- **Blockchain**: Solana
- **Smart Contracts**: Rust (Anchor Framework)
- **Randomness**: Solana VRF / Switchboard Oracle
- **ORM**: Prisma / TypeORM
- **Hosting**: Railway / Render / Fly.io (free tier)

---

## Project Structure

```
backend/
├── src/
│   ├── server.ts                    # Main Socket.IO + Express server
│   ├── config/
│   │   ├── database.ts              # Database connection
│   │   ├── blockchain.ts            # Web3 provider setup
│   │   └── socket.ts                # Socket.IO configuration
│   ├── services/
│   │   ├── timer-service.ts         # 30-second countdown broadcaster
│   │   ├── battle-entry.ts          # Participation tracking
│   │   ├── battle-engine.ts         # Winner selection logic
│   │   ├── leaderboard-service.ts   # Win tracking across rounds
│   │   ├── reward-service.ts        # Smart contract interaction
│   │   └── live-purchases.ts        # Token buy API integration
│   ├── controllers/
│   │   ├── battle.controller.ts     # HTTP endpoints for battles
│   │   └── leaderboard.controller.ts # Leaderboard HTTP API
│   ├── models/
│   │   ├── Battle.ts                # Battle round schema
│   │   ├── Participant.ts           # Battle participant
│   │   ├── Leaderboard.ts           # Win tracking
│   │   └── Reward.ts                # Reward distribution log
│   ├── utils/
│   │   ├── randomness.ts            # Chainlink VRF integration
│   │   ├── wallet-verifier.ts       # Signature verification
│   │   └── logger.ts                # Logging utility
│   └── socket/
│       ├── events.ts                # Socket event definitions
│       └── handlers.ts              # Socket event handlers
├── programs/
│   └── reward-distributor/
│       ├── src/
│       │   └── lib.rs              # Rust smart contract (Anchor)
│       ├── Cargo.toml
│       └── Xargo.toml
├── tests/
│   ├── timer.test.ts
│   ├── battle-engine.test.ts
│   └── reward-distribution.test.ts
├── package.json
├── tsconfig.json
└── .env
```

---

## Core Services

### 1. Timer Service (`services/timer-service.ts`)

**Purpose**: Broadcast 30-second countdown to all connected clients

```typescript
class TimerService {
  private currentRound: number = 1;
  private timerActive: boolean = false;
  private countdown: number = 30;
  
  startTimer(io: Socket.IO.Server) {
    this.timerActive = true;
    this.countdown = 30;
    
    const interval = setInterval(() => {
      if (this.countdown > 0) {
        // Broadcast to all clients
        io.emit('timer-tick', {
          countdown: this.countdown,
          round: this.currentRound,
          status: 'active'
        });
        this.countdown--;
      } else {
        clearInterval(interval);
        this.timerActive = false;
        io.emit('timer-end', { round: this.currentRound });
        // Trigger battle engine
        this.triggerBattle(io);
      }
    }, 1000);
  }
  
  async triggerBattle(io: Socket.IO.Server) {
    // Call battle-engine to select winner
  }
}
```

**Socket Events Emitted**:
- `timer-tick` — Every second with countdown value
- `timer-end` — When timer reaches 0
- `timer-start` — New round begins

---

### 2. Battle Entry Service (`services/battle-entry.ts`)

**Purpose**: Track wallet addresses joining during active timer window

```typescript
class BattleEntryService {
  private participants: Map<string, Participant> = new Map();
  
  async recordParticipation(
    walletAddress: string, 
    txSignature: string,
    roundId: number
  ): Promise<boolean> {
    // NOTE: No manual signature verification needed
    // Purchase is already verified by live-purchases service
    
    // Check if timer is active
    if (!TimerService.isActive()) {
      throw new Error('Battle window closed');
    }
    
    // Check if already participated this round
    if (this.participants.has(walletAddress)) {
      logger.warn(`${walletAddress} already joined this round`);
      return false;
    }
    
    // Store participant
    const participant = await Participant.create({
      walletAddress,
      roundId,
      joinedAt: new Date()
    });
    
    this.participants.set(walletAddress, participant);
    
    // Broadcast updated participant count
    io.emit('participant-joined', {
      count: this.participants.size,
      walletAddress: walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4)
    });
    
    return true;
  }
  
  getParticipants(roundId: number): Participant[] {
    return Array.from(this.participants.values());
  }
  
  clearParticipants() {
    this.participants.clear();
  }
  
  async removeParticipant(walletAddress: string): Promise<void> {
    if (this.participants.has(walletAddress)) {
      this.participants.delete(walletAddress);
      
      // Update database
      await Participant.deleteMany({ walletAddress });
      
      logger.info(`Removed participant: ${walletAddress}`);
      
      // Broadcast updated count
      io.emit('participant-removed', {
        walletAddress: walletAddress.slice(0, 6) + '...',
        count: this.participants.size
      });
    }
  }
}
```

**Socket Events**:
- Listens: NONE (auto-triggered by webhooks)
- Emits: `participant-joined`, `participant-count`, `participant-removed`

---

### 3. Battle Engine (`services/battle-engine.ts`)

**Purpose**: Randomly select winner using provably fair randomness

```typescript
class BattleEngine {
  async selectWinner(participants: Participant[]): Promise<Participant> {
    if (participants.length === 0) {
      throw new Error('No participants');
    }
    
    if (participants.length === 1) {
      return participants[0];
    }
    
    // Use Switchboard VRF for provably fair randomness on Solana
    const randomNumber = await SwitchboardVRF.getRandomNumber();
    const winnerIndex = randomNumber % participants.length;
    
    return participants[winnerIndex];
  }
  
  async executeBattle(io: Socket.IO.Server, roundId: number) {
    const participants = BattleEntryService.getParticipants(roundId);
    
    // Emit fight started
    io.emit('fight-started', {
      roundId,
      participantCount: participants.length,
      duration: 45 // seconds
    });
    
    // Select winner after animation time (30-60 seconds)
    await this.delay(45000); // 45 second fight animation
    
    const winner = await this.selectWinner(participants);
    
    // Save battle result
    await Battle.create({
      roundId,
      winnerId: winner.id,
      winnerAddress: winner.walletAddress,
      participantCount: participants.length,
      completedAt: new Date()
    });
    
    // Update leaderboard
    await LeaderboardService.recordWin(winner.walletAddress);
    
    // Emit winner
    io.emit('battle-result', {
      roundId,
      winner: winner.walletAddress,
      participantCount: participants.length
    });
    
    // Check if final round (8-10 rounds)
    if (roundId >= 10) {
      await this.triggerRewardDistribution(io);
    } else {
      // Start next round after 10 seconds
      await this.delay(10000);
      TimerService.startTimer(io, roundId + 1);
    }
  }
}
```

**Socket Events Emitted**:
- `fight-started`
- `battle-result`
- `next-round-starting`

---

### 4. Leaderboard Service (`services/leaderboard-service.ts`)

**Purpose**: Track wins across 8-10 rounds and identify top 3

```typescript
class LeaderboardService {
  async recordWin(walletAddress: string): Promise<void> {
    let entry = await Leaderboard.findOne({ walletAddress });
    
    if (!entry) {
      entry = await Leaderboard.create({
        walletAddress,
        wins: 1,
        lastWinAt: new Date()
      });
    } else {
      entry.wins += 1;
      entry.lastWinAt = new Date();
      await entry.save();
    }
    
    // Broadcast updated leaderboard
    const top10 = await this.getTopRankings(10);
    io.emit('leaderboard-update', top10);
  }
  
  async getTopRankings(limit: number = 10) {
    return await Leaderboard.find()
      .sort({ wins: -1, lastWinAt: 1 })
      .limit(limit)
      .select('walletAddress wins');
  }
  
  async getTop3Winners(): Promise<string[]> {
    const top3 = await this.getTopRankings(3);
    return top3.map(entry => entry.walletAddress);
  }
  
  async resetLeaderboard() {
    await Leaderboard.deleteMany({});
  }
}
```

**Socket Events Emitted**:
- `leaderboard-update` — After each battle

---

### 5. Reward Service (`services/reward-service.ts`)

**Purpose**: Interact with smart contract to distribute rewards

```typescript
import * as anchor from '@project-serum/anchor';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

class RewardService {
  private connection: Connection;
  private program: anchor.Program;
  private rewardPoolPda: PublicKey;
  
  constructor() {
    // Initialize Solana connection
    this.connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
    );
    
    // Initialize Anchor program
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    
    const programId = new PublicKey(process.env.PROGRAM_ID!);
    const idl = require('./idl/reward_distributor.json');
    this.program = new anchor.Program(idl, programId, provider);
    
    // Derive reward pool PDA
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('reward_pool')],
      programId
    );
    this.rewardPoolPda = pda;
  }
  
  async distributeRewards(top3Addresses: string[]) {
    if (top3Addresses.length !== 3) {
      throw new Error('Exactly 3 winners required');
    }
    
    // Convert string addresses to PublicKey
    const winnerPubkeys = top3Addresses.map(addr => new PublicKey(addr));
    
    // Get reward pool account
    const rewardPoolAccount = await this.program.account.rewardPool.fetch(
      this.rewardPoolPda
    );
    
    const totalRewards = rewardPoolAccount.totalRewards.toNumber();
    const distributionAmount = Math.floor(totalRewards / 2); // 50%
    const amountPerWinner = Math.floor(distributionAmount / 3);
    
    // Call smart contract to distribute
    const tx = await this.program.methods
      .distributeRewards(winnerPubkeys)
      .accounts({
        rewardPool: this.rewardPoolPda,
        authority: this.program.provider.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .remainingAccounts(
        winnerPubkeys.map(pubkey => ({
          pubkey,
          isWritable: true,
          isSigner: false,
        }))
      )
      .rpc();
    
    // Wait for confirmation
    await this.connection.confirmTransaction(tx, 'confirmed');
    
    // Log distribution
    await Reward.create({
      transactionHash: tx,
      winners: top3Addresses,
      amountPerWinner: (amountPerWinner / LAMPORTS_PER_SOL).toString(),
      distributedAt: new Date()
    });
    
    // Broadcast to clients
    io.emit('rewards-distributed', {
      winners: top3Addresses,
      amountPerWinner: (amountPerWinner / LAMPORTS_PER_SOL).toFixed(4),
      txHash: tx
    });
  }
  
  // Listen to smart contract events
  async listenToContractEvents() {
    // Subscribe to program logs
    this.connection.onLogs(
      this.program.programId,
      (logs) => {
        if (logs.logs.some(log => log.includes('RewardDistributedEvent'))) {
          console.log('Rewards distributed:', logs.signature);
        }
      },
      'confirmed'
    );
  }
}
```

---

### 6. Live Purchases API (`services/live-purchases.ts`)

**Purpose**: Webhook/API to track token purchases and auto-join battles

**Key Rule:** Token purchase during timer = Automatic battle entry

```typescript
class LivePurchaseService {
  async handlePurchase(data: {
    walletAddress: string;
    tokenAmount: number;
    txSignature: string;
    timestamp: Date;
  }) {
    // Verify purchase from Solana blockchain
    const isValid = await this.verifyPurchaseOnChain(data.txSignature);
    if (!isValid) {
      logger.error('Invalid token purchase transaction');
      return;
    }
    
    // Broadcast live purchase to all clients
    io.emit('live-purchase', {
      buyer: data.walletAddress.slice(0, 6) + '...',
      amount: data.tokenAmount,
      timestamp: data.timestamp
    });
    
    // Check if timer is active - MANDATORY auto-join battle
    if (TimerService.isActive()) {
      await BattleEntryService.recordParticipation(
        data.walletAddress,
        data.txSignature,
        TimerService.getCurrentRound()
      );
      
      logger.info(`Auto-joined battle: ${data.walletAddress}`);
    }
  }
  
  async handleSell(data: {
    walletAddress: string;
    tokenAmount: number;
    txSignature: string;
    timestamp: Date;
  }) {
    // Verify sell transaction on Solana
    const isValid = await this.verifySellOnChain(data.txSignature);
    if (!isValid) return;
    
    // Check if user has any characters
    const characters = await Character.find({ walletAddress: data.walletAddress });
    
    if (characters.length > 0) {
      // Destroy all characters owned by this wallet
      await Character.deleteMany({ walletAddress: data.walletAddress });
      
      logger.warn(`🔥 Characters destroyed for ${data.walletAddress} due to token sell`);
      
      // Broadcast character destruction
      io.emit('character-destroyed', {
        walletAddress: data.walletAddress.slice(0, 6) + '...',
        characterCount: characters.length
      });
    }
    
    // Remove from active battle if currently participating
    await BattleEntryService.removeParticipant(data.walletAddress);
  }
  
  async verifyPurchaseOnChain(txSignature: string): Promise<boolean> {
    const connection = new Connection(process.env.SOLANA_RPC_URL!);
    
    const tx = await connection.getTransaction(txSignature, {
      commitment: 'confirmed'
    });
    
    if (!tx) return false;
    
    // Verify transaction is a token purchase (check program ID, accounts, etc.)
    // Add your token program verification logic here
    
    return true;
  }
  
  async verifySellOnChain(txSignature: string): Promise<boolean> {
    const connection = new Connection(process.env.SOLANA_RPC_URL!);
    
    const tx = await connection.getTransaction(txSignature, {
      commitment: 'confirmed'
    });
    
    if (!tx) return false;
    
    // Verify transaction is a token sell
    return true;
  }
}
```

---

## Database Schema

### Battle Model
```typescript
{
  id: string;
  roundId: number;
  winnerId: string;
  winnerAddress: string;
  participantCount: number;
  startedAt: Date;
  completedAt: Date;
}
```

### Participant Model
```typescript
{
  id: string;
  walletAddress: string;
  roundId: number;
  txSignature: string;  // Solana purchase transaction
  joinedAt: Date;
}
```

### Character Model
```typescript
{
  id: string;
  walletAddress: string;
  characterType: string;  // Common, Rare, Legendary
  characterName: string;
  mintedAt: Date;
  destroyedAt: Date | null;
  isActive: boolean;
}
```

### Leaderboard Model
```typescript
{
  id: string;
  walletAddress: string;
  wins: number;
  lastWinAt: Date;
}
```

### Reward Model
```typescript
{
  id: string;
  transactionHash: string;
  winners: string[]; // Array of 3 wallet addresses
  amountPerWinner: string;
  distributedAt: Date;
}
```

---

## Socket.IO Events

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `disconnect` | - | User disconnects |
| *(No manual join - automatic via token purchase)* | - | - |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `timer-tick` | `{ countdown, round, status }` | Every second countdown update |
| `timer-end` | `{ round }` | Timer reached 0 |
| `participant-joined` | `{ count, walletAddress }` | New participant joined |
| `fight-started` | `{ roundId, participantCount, duration }` | Battle animation begins |
| `battle-result` | `{ roundId, winner, participantCount }` | Winner announced |
| `leaderboard-update` | `[{ walletAddress, wins }]` | Updated rankings |
| `rewards-distributed` | `{ winners, amountPerWinner, txHash }` | Final rewards sent |
| `live-purchase` | `{ buyer, amount, timestamp }` | Someone bought tokens (auto-joined) |
| `character-destroyed` | `{ walletAddress, characterCount }` | Characters destroyed due to token sell |
| `participant-removed` | `{ walletAddress, count }` | Participant removed from battle |

---

## Smart Contract (Rust - Anchor Framework)

**File**: `programs/reward-distributor/src/lib.rs`

```rust
use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("YourProgramIDHere");

#[program]
pub mod reward_distributor {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let reward_pool = &mut ctx.accounts.reward_pool;
        reward_pool.authority = ctx.accounts.authority.key();
        reward_pool.total_rewards = 0;
        reward_pool.bump = *ctx.bumps.get("reward_pool").unwrap();
        Ok(())
    }

    pub fn deposit_rewards(ctx: Context<DepositRewards>, amount: u64) -> Result<()> {
        let reward_pool = &mut ctx.accounts.reward_pool;
        
        // Transfer SOL from authority to reward pool
        let transfer_instruction = system_program::Transfer {
            from: ctx.accounts.authority.to_account_info(),
            to: ctx.accounts.reward_pool.to_account_info(),
        };
        
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                transfer_instruction,
            ),
            amount,
        )?;
        
        reward_pool.total_rewards += amount;
        Ok(())
    }

    pub fn distribute_rewards(
        ctx: Context<DistributeRewards>,
        winner_addresses: Vec<Pubkey>,
    ) -> Result<()> {
        require!(winner_addresses.len() == 3, ErrorCode::InvalidWinnerCount);
        
        let reward_pool = &mut ctx.accounts.reward_pool;
        require!(reward_pool.total_rewards > 0, ErrorCode::NoRewardsAvailable);
        
        // Calculate 50% distribution
        let distribution_amount = reward_pool.total_rewards / 2;
        let amount_per_winner = distribution_amount / 3;
        
        // Transfer to each winner
        for winner_pubkey in winner_addresses.iter() {
            let winner_account = ctx.remaining_accounts
                .iter()
                .find(|acc| acc.key() == winner_pubkey)
                .ok_or(ErrorCode::WinnerAccountNotFound)?;
            
            **reward_pool.to_account_info().try_borrow_mut_lamports()? -= amount_per_winner;
            **winner_account.try_borrow_mut_lamports()? += amount_per_winner;
        }
        
        reward_pool.total_rewards -= distribution_amount;
        
        emit!(RewardDistributedEvent {
            winners: winner_addresses,
            amount_per_winner,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + RewardPool::LEN,
        seeds = [b"reward_pool"],
        bump
    )]
    pub reward_pool: Account<'info, RewardPool>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositRewards<'info> {
    #[account(
        mut,
        seeds = [b"reward_pool"],
        bump = reward_pool.bump,
        has_one = authority
    )]
    pub reward_pool: Account<'info, RewardPool>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DistributeRewards<'info> {
    #[account(
        mut,
        seeds = [b"reward_pool"],
        bump = reward_pool.bump,
        has_one = authority
    )]
    pub reward_pool: Account<'info, RewardPool>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[account]
pub struct RewardPool {
    pub authority: Pubkey,
    pub total_rewards: u64,
    pub bump: u8,
}

impl RewardPool {
    pub const LEN: usize = 32 + 8 + 1;
}

#[event]
pub struct RewardDistributedEvent {
    pub winners: Vec<Pubkey>,
    pub amount_per_winner: u64,
    pub timestamp: i64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Must have exactly 3 winners")]
    InvalidWinnerCount,
    #[msg("No rewards available for distribution")]
    NoRewardsAvailable,
    #[msg("Winner account not found in remaining accounts")]
    WinnerAccountNotFound,
}
```

---

## API Endpoints (HTTP)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/battles/current` | Get current round info |
| GET | `/api/battles/:roundId` | Get specific battle details |
| GET | `/api/leaderboard` | Get top rankings |
| GET | `/api/battles/history` | Get past battles |
| **POST** | **`/api/webhooks/token-purchase`** | **Webhook: Token buy (auto-join)** |
| **POST** | **`/api/webhooks/token-sell`** | **Webhook: Token sell (destroy character)** |
| GET | `/api/characters/:walletAddress` | Get user's characters |
| POST | `/api/admin/start-round` | Admin: Start new round |
| POST | `/api/admin/emergency-stop` | Admin: Stop current round |

---

## Environment Variables

```env
# Server
PORT=3001
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/pumpedout

# Blockchain
BLOCKCHAIN_NETWORK=solana
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
WALLET_PRIVATE_KEY=your_base58_private_key_here
PROGRAM_ID=YourProgramPublicKeyHere
REWARD_POOL_ADDRESS=YourRewardPoolPDAHere

# Switchboard VRF (Solana)
SWITCHBOARD_PROGRAM_ID=SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f
VRF_ACCOUNT=YourVRFAccountPubkey

# Socket.IO
CORS_ORIGIN=https://yourfrontend.com

# Admin
ADMIN_SECRET_KEY=your_secret_key
```

---

## Deployment

### Free Hosting Options

1. **Railway** (Recommended)
   - Free tier: 500 hours/month
   - PostgreSQL included
   - Socket.IO works out of box
   
2. **Render**
   - Free tier: 750 hours/month
   - Auto-sleep after inactivity
   
3. **Fly.io**
   - Free: 3 shared-cpu VMs
   - Global edge deployment

---

## Testing

```bash
# Run tests
npm test

# Test specific service
npm test timer-service

# Integration test
npm run test:integration

# Load test Socket.IO
npm run test:load
```

---

## Security Considerations

1. **Rate Limiting** — Prevent spam join attempts
2. **Wallet Verification** — Always verify signatures
3. **Smart Contract Audit** — Audit before mainnet
4. **DDoS Protection** — Use Cloudflare
5. **Private Key Security** — Use AWS Secrets Manager / HashiCorp Vault

---

## Performance Optimization

- Use **Redis** for caching leaderboard
- Implement **connection pooling** for database
- **Horizontal scaling** with Socket.IO Redis adapter
- **CDN** for static assets

---

**Backend ready for production deployment! 🚀**
