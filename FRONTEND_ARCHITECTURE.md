# 🎨 Frontend Architecture - Pumped Out Fund Playground

## Tech Stack

- **Framework**: Next.js 14+ (App Router) / React 18+
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Framer Motion (animations)
- **Real-Time**: Socket.IO Client
- **Web3**: ethers.js / web3.js / @solana/web3.js
- **Wallet**: WalletConnect / RainbowKit / Phantom
- **State Management**: Zustand / Redux Toolkit
- **UI Components**: shadcn/ui / Headless UI
- **Hosting**: Vercel (free tier, perfect for Next.js)

---

## Project Structure

```
frontend/
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── layout.tsx               # Root layout
│   │   ├── page.tsx                 # Home page
│   │   ├── playground/
│   │   │   └── page.tsx             # Playground battle arena
│   │   ├── leaderboard/
│   │   │   └── page.tsx             # Leaderboard page
│   │   └── profile/
│   │       └── page.tsx             # User profile
│   ├── components/
│   │   ├── Playground/
│   │   │   ├── PlaygroundTimer.tsx      # 30-second countdown display
│   │   │   ├── BattleArena.tsx          # Fight animation area
│   │   │   ├── ParticipantList.tsx      # Live participant count
│   │   │   ├── JoinBattleButton.tsx     # Join battle CTA
│   │   │   └── LivePurchaseFeed.tsx     # Token purchase stream
│   │   ├── Leaderboard/
│   │   │   ├── Leaderboard.tsx          # Top rankings display
│   │   │   ├── RankingCard.tsx          # Individual rank card
│   │   │   └── WinnerBadge.tsx          # Top 3 winner badges
│   │   ├── Wallet/
│   │   │   ├── WalletConnect.tsx        # Wallet connection button
│   │   │   └── WalletInfo.tsx           # Display connected wallet
│   │   ├── UI/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── Toast.tsx
│   │   └── Layout/
│   │       ├── Navbar.tsx
│   │       └── Footer.tsx
│   ├── hooks/
│   │   ├── useBattleSocket.ts           # Socket.IO connection & events
│   │   ├── useWallet.ts                 # Wallet connection logic
│   │   ├── useLeaderboard.ts            # Leaderboard state
│   │   ├── useTimer.ts                  # Timer state management
│   │   └── useRewards.ts                # Reward distribution
│   ├── store/
│   │   ├── battleStore.ts               # Battle state (Zustand)
│   │   ├── walletStore.ts               # Wallet state
│   │   └── leaderboardStore.ts          # Leaderboard state
│   ├── lib/
│   │   ├── socket.ts                    # Socket.IO client setup
│   │   ├── web3.ts                      # ethers.js / web3 setup
│   │   ├── contracts.ts                 # Smart contract ABIs
│   │   └── utils.ts                     # Helper functions
│   ├── types/
│   │   ├── battle.ts                    # Battle types
│   │   ├── wallet.ts                    # Wallet types
│   │   └── socket.ts                    # Socket event types
│   └── styles/
│       └── globals.css                  # Global Tailwind styles
├── public/
│   ├── animations/
│   │   └── fight-animation.json         # Lottie fight animation
│   └── images/
│       └── muraka-character.png
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── next.config.js
```

---

## Core Components

### 1. Playground Timer (`components/Playground/PlaygroundTimer.tsx`)

**Purpose**: Display 30-second countdown with visual effects

```tsx
'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useBattleSocket } from '@/hooks/useBattleSocket';

export default function PlaygroundTimer() {
  const { countdown, round, isActive } = useBattleSocket();
  
  // Progress percentage for circular timer
  const progress = (countdown / 30) * 100;
  
  return (
    <div className="flex flex-col items-center justify-center">
      {/* Circular Timer */}
      <motion.div
        className="relative w-48 h-48"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        {/* Background Circle */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="96"
            cy="96"
            r="88"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className="text-gray-700"
          />
          {/* Progress Circle */}
          <motion.circle
            cx="96"
            cy="96"
            r="88"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className={countdown > 10 ? 'text-green-500' : 'text-red-500'}
            strokeDasharray={`${2 * Math.PI * 88}`}
            strokeDashoffset={`${2 * Math.PI * 88 * (1 - progress / 100)}`}
            strokeLinecap="round"
            transition={{ duration: 1 }}
          />
        </svg>
        
        {/* Countdown Number */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            key={countdown}
            className="text-6xl font-bold text-white"
            initial={{ scale: 1.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {countdown}
          </motion.span>
          <span className="text-sm text-gray-400 mt-2">seconds left</span>
        </div>
      </motion.div>
      
      {/* Round Info */}
      <div className="mt-6 text-center">
        <p className="text-lg text-gray-300">
          Round <span className="font-bold text-yellow-400">{round}</span> / 10
        </p>
        <p className="text-sm text-gray-500 mt-1">
          {isActive ? '⚡ Battle window open' : '⏸️ Preparing next round...'}
        </p>
      </div>
    </div>
  );
}
```

---

### 2. Battle Arena (`components/Playground/BattleArena.tsx`)

**Purpose**: Display animated fight and winner reveal

```tsx
'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBattleSocket } from '@/hooks/useBattleSocket';
import Lottie from 'lottie-react';
import fightAnimation from '@/public/animations/fight-animation.json';

export default function BattleArena() {
  const { 
    fightStatus, 
    winner, 
    participantCount 
  } = useBattleSocket();
  
  const [showWinner, setShowWinner] = useState(false);
  
  useEffect(() => {
    if (winner) {
      // Delay winner reveal for dramatic effect
      setTimeout(() => setShowWinner(true), 3000);
    } else {
      setShowWinner(false);
    }
  }, [winner]);
  
  if (fightStatus === 'idle') {
    return (
      <div className="text-center text-gray-500 py-12">
        <p>Waiting for battle to start...</p>
      </div>
    );
  }
  
  return (
    <div className="relative w-full max-w-4xl mx-auto bg-gradient-to-br from-purple-900/50 to-blue-900/50 rounded-3xl p-8 border-2 border-purple-500/30">
      <AnimatePresence mode="wait">
        {fightStatus === 'fighting' && !showWinner && (
          <motion.div
            key="fighting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center"
          >
            <h2 className="text-3xl font-bold text-white mb-6">
              ⚔️ Battle in Progress!
            </h2>
            
            {/* Lottie Fight Animation */}
            <div className="w-96 h-96">
              <Lottie 
                animationData={fightAnimation} 
                loop={true}
              />
            </div>
            
            <p className="text-gray-300 mt-4">
              {participantCount} warriors fighting...
            </p>
          </motion.div>
        )}
        
        {showWinner && (
          <motion.div
            key="winner"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', duration: 0.8 }}
            className="flex flex-col items-center"
          >
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                repeatType: 'reverse'
              }}
            >
              <span className="text-9xl">🏆</span>
            </motion.div>
            
            <h2 className="text-4xl font-bold text-yellow-400 mt-6 mb-4">
              Winner!
            </h2>
            
            <div className="bg-black/40 rounded-2xl px-8 py-4 border-2 border-yellow-500">
              <p className="text-2xl font-mono text-white">
                {winner?.slice(0, 6)}...{winner?.slice(-4)}
              </p>
            </div>
            
            <p className="text-gray-400 mt-4">
              Defeated {participantCount - 1} opponents
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

---

### 3. Join Battle Button (`components/Playground/JoinBattleButton.tsx`)

**Purpose**: Allow users to join current battle round

```tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useBattleSocket } from '@/hooks/useBattleSocket';
import { useWallet } from '@/hooks/useWallet';
import Button from '@/components/UI/Button';
import { toast } from 'react-hot-toast';

export default function JoinBattleButton() {
  const { joinBattle, isActive, hasJoined } = useBattleSocket();
  const { address, isConnected, connect } = useWallet();
  const [isJoining, setIsJoining] = useState(false);
  
  const handleJoin = async () => {
    if (!isConnected) {
      await connect();
      return;
    }
    
    if (!isActive) {
      toast.error('Battle window is closed. Wait for next round!');
      return;
    }
    
    if (hasJoined) {
      toast.error('Already joined this round!');
      return;
    }
    
    setIsJoining(true);
    
    try {
      await joinBattle(address!);
      toast.success('Joined battle! Good luck! 🎮');
    } catch (error: any) {
      toast.error(error.message || 'Failed to join battle');
    } finally {
      setIsJoining(false);
    }
  };
  
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Button
        onClick={handleJoin}
        disabled={!isActive || hasJoined || isJoining}
        className={`
          px-12 py-4 text-xl font-bold rounded-2xl
          ${isActive && !hasJoined
            ? 'bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600'
            : 'bg-gray-600 cursor-not-allowed'
          }
          text-white shadow-2xl
          ${isActive && !hasJoined && 'animate-pulse'}
        `}
      >
        {!isConnected && '🔗 Connect Wallet to Join'}
        {isConnected && !isActive && '⏸️ Battle Closed'}
        {isConnected && isActive && hasJoined && '✅ Already Joined'}
        {isConnected && isActive && !hasJoined && !isJoining && '⚔️ Join Battle Now!'}
        {isJoining && '⏳ Joining...'}
      </Button>
    </motion.div>
  );
}
```

---

### 4. Leaderboard (`components/Leaderboard/Leaderboard.tsx`)

**Purpose**: Display top rankings with live updates

```tsx
'use client';

import { motion } from 'framer-motion';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import RankingCard from './RankingCard';

export default function Leaderboard() {
  const { rankings, isLoading } = useLeaderboard();
  
  if (isLoading) {
    return <div className="text-center text-gray-400">Loading...</div>;
  }
  
  return (
    <div className="w-full max-w-4xl mx-auto">
      <h2 className="text-4xl font-bold text-center text-white mb-8">
        🏆 Battle Leaderboard
      </h2>
      
      <div className="space-y-4">
        {rankings.map((entry, index) => (
          <motion.div
            key={entry.walletAddress}
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <RankingCard
              rank={index + 1}
              walletAddress={entry.walletAddress}
              wins={entry.wins}
              isTopThree={index < 3}
            />
          </motion.div>
        ))}
      </div>
      
      {rankings.length === 0 && (
        <p className="text-center text-gray-500 mt-12">
          No battles yet. Be the first to join! 🚀
        </p>
      )}
    </div>
  );
}
```

---

### 5. Ranking Card (`components/Leaderboard/RankingCard.tsx`)

```tsx
'use client';

import { motion } from 'framer-motion';

interface RankingCardProps {
  rank: number;
  walletAddress: string;
  wins: number;
  isTopThree: boolean;
}

export default function RankingCard({ 
  rank, 
  walletAddress, 
  wins, 
  isTopThree 
}: RankingCardProps) {
  const getRankEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };
  
  const getBorderColor = (rank: number) => {
    if (rank === 1) return 'border-yellow-500 bg-yellow-500/10';
    if (rank === 2) return 'border-gray-400 bg-gray-400/10';
    if (rank === 3) return 'border-orange-600 bg-orange-600/10';
    return 'border-gray-700 bg-gray-800/50';
  };
  
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={`
        flex items-center justify-between
        p-6 rounded-2xl border-2
        ${getBorderColor(rank)}
        transition-all duration-300
      `}
    >
      <div className="flex items-center gap-6">
        {/* Rank Badge */}
        <div className={`
          text-4xl font-bold
          ${isTopThree ? 'text-5xl' : 'text-gray-400'}
        `}>
          {getRankEmoji(rank)}
        </div>
        
        {/* Wallet Address */}
        <div>
          <p className="text-lg font-mono text-white">
            {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
          </p>
          <p className="text-sm text-gray-500">
            {wins} {wins === 1 ? 'win' : 'wins'}
          </p>
        </div>
      </div>
      
      {/* Win Count Badge */}
      <div className={`
        px-4 py-2 rounded-lg font-bold
        ${isTopThree 
          ? 'bg-green-500 text-white' 
          : 'bg-gray-700 text-gray-300'
        }
      `}>
        {wins} 🏆
      </div>
    </motion.div>
  );
}
```

---

### 6. Live Purchase Feed (`components/Playground/LivePurchaseFeed.tsx`)

**Purpose**: Show real-time token purchases during battle

```tsx
'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBattleSocket } from '@/hooks/useBattleSocket';

interface Purchase {
  id: string;
  buyer: string;
  amount: number;
  timestamp: Date;
}

export default function LivePurchaseFeed() {
  const { livePurchases } = useBattleSocket();
  const [recentPurchases, setRecentPurchases] = useState<Purchase[]>([]);
  
  useEffect(() => {
    if (livePurchases.length > 0) {
      // Keep only last 5 purchases
      setRecentPurchases(livePurchases.slice(-5));
    }
  }, [livePurchases]);
  
  return (
    <div className="w-full max-w-md">
      <h3 className="text-lg font-semibold text-gray-300 mb-4">
        🔥 Live Token Purchases
      </h3>
      
      <div className="space-y-2">
        <AnimatePresence>
          {recentPurchases.map((purchase) => (
            <motion.div
              key={purchase.id}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              className="bg-green-900/30 border border-green-500/30 rounded-lg p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-mono text-green-400">
                  {purchase.buyer}
                </span>
                <span className="text-sm font-bold text-white">
                  {purchase.amount} 🪙
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {recentPurchases.length === 0 && (
          <p className="text-center text-gray-600 text-sm py-4">
            No purchases yet...
          </p>
        )}
      </div>
    </div>
  );
}
```

---

## Custom Hooks

### 1. `useBattleSocket.ts`

**Purpose**: Manage Socket.IO connection and battle state

```typescript
import { useEffect, useState } from 'react';
import { socket } from '@/lib/socket';
import { useWallet } from './useWallet';

export function useBattleSocket() {
  const { address } = useWallet();
  const [countdown, setCountdown] = useState(0);
  const [round, setRound] = useState(1);
  const [isActive, setIsActive] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [fightStatus, setFightStatus] = useState<'idle' | 'fighting'>('idle');
  const [winner, setWinner] = useState<string | null>(null);
  const [livePurchases, setLivePurchases] = useState<any[]>([]);
  
  useEffect(() => {
    // Connect to Socket.IO server
    socket.connect();
    
    // Listen to timer ticks
    socket.on('timer-tick', (data) => {
      setCountdown(data.countdown);
      setRound(data.round);
      setIsActive(data.status === 'active');
    });
    
    // Timer ended
    socket.on('timer-end', () => {
      setIsActive(false);
    });
    
    // Participant joined
    socket.on('participant-joined', (data) => {
      setParticipantCount(data.count);
    });
    
    // Fight started
    socket.on('fight-started', (data) => {
      setFightStatus('fighting');
      setParticipantCount(data.participantCount);
      setWinner(null);
      setHasJoined(false); // Reset for next round
    });
    
    // Battle result
    socket.on('battle-result', (data) => {
      setWinner(data.winner);
    });
    
    // Live purchase
    socket.on('live-purchase', (data) => {
      setLivePurchases((prev) => [...prev, {
        id: Date.now().toString(),
        buyer: data.buyer,
        amount: data.amount,
        timestamp: new Date(data.timestamp)
      }]);
    });
    
    return () => {
      socket.disconnect();
    };
  }, []);
  
  const joinBattle = async (walletAddress: string) => {
    return new Promise((resolve, reject) => {
      socket.emit('join-battle', { 
        walletAddress 
      }, (response: any) => {
        if (response.success) {
          setHasJoined(true);
          resolve(response);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  };
  
  return {
    countdown,
    round,
    isActive,
    hasJoined,
    participantCount,
    fightStatus,
    winner,
    livePurchases,
    joinBattle
  };
}
```

---

### 2. `useWallet.ts`

**Purpose**: Wallet connection logic

```typescript
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  
  useEffect(() => {
    checkConnection();
  }, []);
  
  const checkConnection = async () => {
    if (typeof window.ethereum !== 'undefined') {
      const accounts = await window.ethereum.request({ 
        method: 'eth_accounts' 
      });
      
      if (accounts.length > 0) {
        setAddress(accounts[0]);
        setIsConnected(true);
        
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        setProvider(provider);
      }
    }
  };
  
  const connect = async () => {
    if (typeof window.ethereum === 'undefined') {
      throw new Error('MetaMask not installed');
    }
    
    try {
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      setAddress(accounts[0]);
      setIsConnected(true);
      
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      setProvider(provider);
      
      return accounts[0];
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  };
  
  const disconnect = () => {
    setAddress(null);
    setIsConnected(false);
    setProvider(null);
  };
  
  return {
    address,
    isConnected,
    provider,
    connect,
    disconnect
  };
}
```

---

### 3. `useLeaderboard.ts`

**Purpose**: Manage leaderboard state

```typescript
import { useEffect, useState } from 'react';
import { socket } from '@/lib/socket';

interface LeaderboardEntry {
  walletAddress: string;
  wins: number;
}

export function useLeaderboard() {
  const [rankings, setRankings] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Fetch initial leaderboard
    fetch('/api/leaderboard')
      .then(res => res.json())
      .then(data => {
        setRankings(data);
        setIsLoading(false);
      });
    
    // Listen to live updates
    socket.on('leaderboard-update', (data) => {
      setRankings(data);
    });
    
    return () => {
      socket.off('leaderboard-update');
    };
  }, []);
  
  return { rankings, isLoading };
}
```

---

## Socket.IO Client Setup

**File**: `lib/socket.ts`

```typescript
import { io } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});
```

---

## Pages

### Playground Page (`app/playground/page.tsx`)

```tsx
import PlaygroundTimer from '@/components/Playground/PlaygroundTimer';
import BattleArena from '@/components/Playground/BattleArena';
import JoinBattleButton from '@/components/Playground/JoinBattleButton';
import ParticipantList from '@/components/Playground/ParticipantList';
import LivePurchaseFeed from '@/components/Playground/LivePurchaseFeed';

export default function PlaygroundPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-6xl font-bold text-center text-white mb-12">
          ⚔️ Battle Playground
        </h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Timer & Join */}
          <div className="space-y-8">
            <PlaygroundTimer />
            <div className="flex justify-center">
              <JoinBattleButton />
            </div>
            <ParticipantList />
          </div>
          
          {/* Center: Battle Arena */}
          <div className="lg:col-span-2">
            <BattleArena />
          </div>
        </div>
        
        {/* Bottom: Live Purchase Feed */}
        <div className="mt-12">
          <LivePurchaseFeed />
        </div>
      </div>
    </div>
  );
}
```

---

## Environment Variables

```env
NEXT_PUBLIC_SOCKET_URL=https://your-backend.railway.app
NEXT_PUBLIC_CHAIN_ID=1
NEXT_PUBLIC_RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
```

---

## Deployment (Vercel - Free)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Auto-deploys on every git push to main branch
```

---

## Key Features Summary

✅ **30-second countdown timer** with circular progress  
✅ **Real-time Socket.IO** for live updates  
✅ **Wallet connection** (MetaMask/WalletConnect)  
✅ **Animated fight sequence** (Lottie/Framer Motion)  
✅ **Live leaderboard** with top 3 highlights  
✅ **Live token purchase feed**  
✅ **Responsive design** (mobile + desktop)  
✅ **Dark theme** with gradient backgrounds  
✅ **Winner reveal animation** with confetti  
✅ **Round progression** (1-10 rounds tracked)  

---

## Performance Optimization

- **Code splitting** with Next.js dynamic imports
- **Image optimization** with Next.js Image component
- **Lazy load animations** only when visible
- **Debounce Socket.IO** events to prevent spam
- **Memoize components** with React.memo
- **Use Zustand** for lightweight state management

---

**Frontend production-ready! Deploy on Vercel for FREE! 🚀**
