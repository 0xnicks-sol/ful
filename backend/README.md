# Pumped Out Fund - Backend

Real-time battle system backend with Socket.IO and Solana integration.

## 🚀 Quick Start

### Prerequisites

- Node.js v18+ 
- PostgreSQL (or MongoDB)
- Solana CLI (for smart contract deployment)

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration (add DATABASE_URL)
nano .env

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Start development server
npm run dev
```

### Database Setup

**Option 1: Local PostgreSQL**
```bash
# Install PostgreSQL (macOS)
brew install postgresql@15
brew services start postgresql@15

# Create database
createdb pumpedout

# Update .env
DATABASE_URL="postgresql://your_user:password@localhost:5432/pumpedout"
```

**Option 2: Supabase (Free Cloud)**
1. Go to https://supabase.com
2. Create new project
3. Copy connection string to .env
```

Server will start on http://localhost:3001

### Auto-Start Timer

In development mode, the first round timer starts automatically after 3 seconds.

## 📡 API Endpoints

### Health Check
```
GET /health
```

### Get Timer State
```
GET /api/timer/state
```

### Start Round (Admin)
```
POST /api/admin/start-round
Body: { roundId?: number }
```

### Token Purchase Webhook
```
POST /api/webhooks/token-purchase
Body: {
  None (auto-join via token purchase webhook)

### Server → Client

- `timer-tick` - Timer countdown update (every 1 second)
- `timer-end` - Timer reached 0
- `participant-joined` - New participant auto-joined (token purchase)
- `participant-removed` - Participant removed (token sold)
- `live-purchase` - Someone bought tokens
- `character-destroyed` - Characters destroyed due to token sell
- `fight-started` - Battle animation begins (30-60s)
- `battle-result` - Winner announced
- `leaderboard-update` - Updated rankings
- `tournament-complete` - Final round complete, top 3 announced

## 🔌 Socket.IO Events

### Client → Server

*Note: No manual join event required. Users auto-join via token purchase webhook.*

### Server → Client

- `timer-tick` - Timer countdown update
- `participant-joined` - New participant joined
- `fight-started` - Battle animation starts
- `battle-result` - Winner revealed
- `leaderboard-update` - Rankings updated
- `tournament-complete` - Tournament ended

## 🏗️ Project Structure

```
backend/
├── src/
│   ├── server.ts              # Main entry point
│   ├── config/
│   │   └── logger.ts          # Winston logger
│   ├── services/
│   │   └── timer-service.ts   # 30-second countdown
│   ├── controllers/           # HTTP controllers (TODO)
│   ├── models/                # Database models (TODO)
│   ├── socket/                # Socket handlers (TODO)
│   └── utils/                 # Utilities (TODO)
├── package.json
├── tsconfig.json
└── .env.example
```

## ✅ Implemented

- [x] Express server setup
- [x] Socket.IO integration
- [x] Timer service (30-second countdown)
- [x] Prisma database schema (PostgreSQL)
- [x] Battle entry service (auto-join via token purchase)
- [x] Live purchase webhook handler
- [x] Token sell detection (character destruction)
- [x] Solana transaction verification
- [x] Battle engine (winner selection)
- [x] Leaderboard service (win tracking)
- [x] Fight animation timing
- [x] Round progression (1-10 rounds)
- [x] Automatic winner selection
- [x] Health check endpoint
- [x] Winston logging
- [x] Environment configuration

## 🚧 TODO

- [ ] Database migrations & seeding
- [ ] Switchboard VRF integration (using blockhash fallback now)
- [ ] Reward distribution service (smart contract integration)
- [ ] Character NFT assignment & minting
- [ ] Rate limiting middleware
- [ ] Admin authentication (JWT)
- [ ] Unit tests & integration tests
- [ ] Performance monitoring
- [ ] Error recovery mechanisms

## 🧪 Testing

Test Socket.IO connection:

```bash
# Install socket.io-client globally
npm install -g socket.io-client

# Connect to server
npx socket.io-client http://localhost:3001
```

## 🔧 Development

```bash
# Development mode with auto-reload
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Run tests
npm test
```

## 📊 Logs

Logs are stored in `logs/` directory:
- `error.log` - Error logs only
- `combined.log` - All logs

## 🌐 Environment Variables

See `.env.example` for all required environment variables.

## 🛡️ Security

- CORS configured for frontend origin
- Rate limiting (TODO)
- JWT authentication for admin routes (TODO)
- Wallet signature verification (TODO)

## 📚 Next Steps

1. **Database Setup** - Run migrations: `npm run prisma:migrate`
2. **Test Full Battle Flow** - Purchase tokens → Timer ends → Winner selected
3. **Switchboard VRF** - Replace blockhash with actual VRF oracle
4. **Reward Distribution** - Implement Anchor program integration
5. **Character NFTs** - Mint characters on token purchase
6. **Production Deploy** - Railway/Render with PostgreSQL

---

**Status:** ⚡ Core timer system working! Ready for battle logic implementation.
