'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface Participant {
  walletAddress: string;
  tokenAmount?: number;
  optimistic?: boolean;  // true = spawned from live-purchase, not yet backend-confirmed
}

interface Purchase {
  id: string;
  buyer: string;
  buyerShort: string;
  amount: number;
  timestamp: Date;
}

interface LeaderboardEntry {
  walletAddress: string;
  wins: number;
}

const MAX_FIGHTERS = 30;

export function useBattleSocket() {
  const [socket,           setSocket]           = useState<Socket | null>(null);
  const [countdown,        setCountdown]        = useState(0);
  const [round,            setRound]            = useState(1);
  const [isActive,         setIsActive]         = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [participants,     setParticipants]     = useState<Participant[]>([]);
  const [fightStatus,      setFightStatus]      = useState<'idle' | 'fighting'>('idle');
  const [winner,           setWinner]           = useState<string | null>(null);
  const [celebrationWinner,setCelebrationWinner]= useState<string | null>(null);
  const [livePurchases,    setLivePurchases]    = useState<Purchase[]>([]);
  const [leaderboard,      setLeaderboard]      = useState<LeaderboardEntry[]>([]);

  // Refs so socket handlers always read the latest values (no stale closure)
  const isActiveRef         = useRef(false);
  const fightInProgressRef  = useRef(false);
  const participantCountRef = useRef(0);
  const celebrationTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep refs in sync with state
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  useEffect(() => { participantCountRef.current = participantCount; }, [participantCount]);
  useEffect(() => { fightInProgressRef.current = fightStatus === 'fighting'; }, [fightStatus]);

  useEffect(() => {
    const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    const s = io(SOCKET_URL, { transports: ['websocket'] });
    setSocket(s);

    s.on('timer-tick', (data) => {
      setCountdown(data.countdown);
      setRound(data.round);
      setIsActive(data.status === 'active');
      setParticipantCount(data.participantCount);
      isActiveRef.current        = data.status === 'active';
      participantCountRef.current = data.participantCount;

      if (data.status === 'idle') {
        setFightStatus('idle');
        setParticipants([]);
        setWinner(null);
        fightInProgressRef.current = false;
      }
    });

    s.on('timer-end', () => {
      setIsActive(false);
      isActiveRef.current = false;
    });

    s.on('participant-joined', (data) => {
      // Backend confirmed this participant — upgrade optimistic entry or add fresh
      setParticipantCount(data.count);
      participantCountRef.current = data.count;
      setParticipants(prev => {
        // Already exists (optimistic or confirmed) → just mark as confirmed
        const existing = prev.find(p => p.walletAddress === data.walletAddress);
        if (existing) {
          return prev.map(p =>
            p.walletAddress === data.walletAddress
              ? { ...p, optimistic: false, tokenAmount: data.tokenAmount }
              : p
          );
        }
        return [...prev, { walletAddress: data.walletAddress, tokenAmount: data.tokenAmount, optimistic: false }];
      });
    });

    s.on('participant-removed', (data) => {
      setParticipants(prev => prev.filter(p => p.walletAddress !== data.walletAddress));
    });

    s.on('fight-started', () => {
      setFightStatus('fighting');
      setWinner(null);
      fightInProgressRef.current = true;
    });

    s.on('battle-result', (data) => {
      setWinner(data.winner);
      setFightStatus('idle');
      fightInProgressRef.current = false;

      setCelebrationWinner(data.winner);
      if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
      celebrationTimer.current = setTimeout(() => setCelebrationWinner(null), 7000);
    });

    s.on('live-purchase', (data) => {
      // ── Option 2: Optimistic spawn ──────────────────────────────────────
      // Immediately add to arena if entry window is open and cap not hit.
      // This makes the fighter appear ~2-3 seconds BEFORE backend confirms.
      if (
        data.canJoin &&
        isActiveRef.current &&
        !fightInProgressRef.current &&
        participantCountRef.current < MAX_FIGHTERS
      ) {
        setParticipants(prev => {
          if (prev.find(p => p.walletAddress === data.buyer)) return prev;
          return [...prev, {
            walletAddress: data.buyer,
            tokenAmount:   data.amount,
            optimistic:    true,
          }];
        });
      }

      // Always update live feed
      setLivePurchases(prev => [...prev, {
        id:         Date.now().toString() + Math.random(),
        buyer:      data.buyer,
        buyerShort: data.buyerShort || data.buyer,
        amount:     data.amount,
        timestamp:  new Date(data.timestamp),
      }].slice(-100));
    });

    s.on('leaderboard-update', (data) => {
      setLeaderboard(data);
    });

    fetch(`${SOCKET_URL}/api/leaderboard`)
      .then(r => r.json())
      .then(data => { if (data.rankings) setLeaderboard(data.rankings); })
      .catch(() => {});

    return () => {
      s.disconnect();
      if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
    };
  }, []);

  return {
    socket,
    countdown,
    round,
    isActive,
    participantCount,
    participants,
    fightStatus,
    winner,
    celebrationWinner,
    livePurchases,
    leaderboard,
  };
}
