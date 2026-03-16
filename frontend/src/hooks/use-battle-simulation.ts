"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { io, Socket } from "socket.io-client"
import type { Fighter } from "@/components/battle-arena"
import type { FeedEvent, FeedEventType } from "@/components/live-feed"
import type { LeaderboardEntry } from "@/components/leaderboard"

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

function getCirclePosition(index: number, total: number, radius = 0.28): { x: number; y: number } {
  if (total === 1) return { x: 0.5, y: 0.5 }
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2
  return {
    x: 0.5 + Math.cos(angle) * radius,
    y: 0.5 + Math.sin(angle) * radius,
  }
}

function getLungePosition(
  self: { x: number; y: number },
  target: { x: number; y: number },
  factor = 0.65
): { x: number; y: number } {
  return {
    x: self.x + (target.x - self.x) * factor,
    y: self.y + (target.y - self.y) * factor,
  }
}

/** Map raw token amount → HP tier */
function getHpFromTokens(tokenAmount: number): number {
  if (tokenAmount >= 5_000_000) return 200
  if (tokenAmount >= 1_000_000) return 150
  if (tokenAmount >= 500_000)   return 120
  if (tokenAmount >= 100_000)   return 100
  return 75
}

function rebuildPositions(fighters: Fighter[]): Fighter[] {
  const alive = fighters.filter((f) => !f.isEliminated)
  return fighters.map((f) => {
    if (f.isEliminated) return f
    const idx = alive.findIndex((a) => a.id === f.id)
    const newBase = getCirclePosition(idx, alive.length)
    return { ...f, basePosition: newBase, position: newBase }
  })
}

function pushFeedEvent(
  setter: React.Dispatch<React.SetStateAction<FeedEvent[]>>,
  type: FeedEventType,
  wallet: string,
  message?: string
) {
  setter((prev) =>
    [
      {
        id:            generateId(),
        type,
        walletAddress: wallet,
        timestamp:     new Date(),
        message,
      },
      ...prev,
    ].slice(0, 100)
  )
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useBattleSimulation() {
  const [fighters,            setFighters]            = useState<Fighter[]>([])
  const [battlePhase,         setBattlePhase]         = useState<"lobby" | "battle" | "finished">("lobby")
  const [countdown,           setCountdown]           = useState(60)
  const [round,               setRound]               = useState(1)
  const [feedEvents,          setFeedEvents]          = useState<FeedEvent[]>([])
  const [leaderboard,         setLeaderboard]         = useState<LeaderboardEntry[]>([])
  const [grandWinners,        setGrandWinners]        = useState<string[]>([])
  const [winnerId,            setWinnerId]            = useState<string | undefined>()
  const [winnerWallet,        setWinnerWallet]        = useState<string | undefined>()
  const [showWinnerPopup,     setShowWinnerPopup]     = useState(false)
  const [totalRoundsCompleted,setTotalRoundsCompleted]= useState(0)

  const battleIntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const celebrationTimer   = useRef<ReturnType<typeof setTimeout>  | null>(null)
  const roundRef           = useRef(1)
  const fightActiveRef     = useRef(false)

  roundRef.current = round

  // ── Local fight animation (visual only — backend decides the real winner) ─
  const startLocalFightAnimation = useCallback(() => {
    fightActiveRef.current = true
    if (battleIntervalRef.current) clearInterval(battleIntervalRef.current)

    battleIntervalRef.current = setInterval(() => {
      setFighters((prev) => {
        const alive = prev.filter((f) => !f.isEliminated)
        if (alive.length <= 1 || !fightActiveRef.current) return prev

        const attackerIdx = Math.floor(Math.random() * alive.length)
        const attacker    = alive[attackerIdx]
        const victims     = alive.filter((f) => f.id !== attacker.id)
        if (victims.length === 0) return prev
        const victim = victims[Math.floor(Math.random() * victims.length)]

        const baseDamage    = Math.floor(attacker.maxHp * 0.06) + Math.floor(Math.random() * 10) + 5
        const newHp         = Math.max(1, victim.hp - baseDamage)   // floor at 1 — backend declares true death
        const willFlinch    = newHp < victim.hp * 0.4               // show big flinch at low hp

        const lungePos  = getLungePosition(attacker.basePosition, victim.basePosition, 0.65)
        const facesRight = victim.basePosition.x >= attacker.basePosition.x

        // Feed event on big hits
        if (willFlinch && Math.random() < 0.3) {
          pushFeedEvent(setFeedEvents, "eliminate", victim.walletAddress)
        }

        const updated = prev.map((f): Fighter => {
          if (f.id === attacker.id)
            return { ...f, state: "attack", position: lungePos, flipped: facesRight, animKey: (f.animKey ?? 0) + 1 }
          if (f.id === victim.id)
            return { ...f, state: "hit", hp: newHp, position: f.basePosition, flipped: !facesRight, animKey: (f.animKey ?? 0) + 1 }
          return { ...f, state: "idle", position: f.basePosition }
        })

        // Snap attacker back after lunge
        setTimeout(() => {
          setFighters((curr) =>
            curr.map((f) =>
              f.id === attacker.id && f.state === "attack"
                ? { ...f, state: "idle", position: f.basePosition }
                : f
            )
          )
        }, 500)

        return updated
      })
    }, 1200)
  }, [])

  // ── Socket setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001"
    const s: Socket  = io(SOCKET_URL, { transports: ["websocket"] })

    // ── timer-tick ─────────────────────────────────────────────────────────
    s.on("timer-tick", (data: { countdown: number; round: number; status: string; participantCount: number }) => {
      setCountdown(data.countdown)
      setRound(data.round)

      if (data.status === "active") {
        setBattlePhase("lobby")
      }

      if (data.status === "idle") {
        // New round started — reset arena
        fightActiveRef.current = false
        if (battleIntervalRef.current) {
          clearInterval(battleIntervalRef.current)
          battleIntervalRef.current = null
        }
        setBattlePhase("lobby")
        setFighters([])
        setWinnerId(undefined)
        setWinnerWallet(undefined)
        setShowWinnerPopup(false)
      }
    })

    // ── participant-joined ─────────────────────────────────────────────────
    // Backend now emits full walletAddress (fixed in battle-entry.ts)
    s.on("participant-joined", (data: { walletAddress: string; tokenAmount: number; count: number }) => {
      setFighters((prev) => {
        // Avoid duplicates
        if (prev.find((f) => f.walletAddress === data.walletAddress)) return prev

        const hp         = getHpFromTokens(data.tokenAmount ?? 0)
        const newFighter: Fighter = {
          id:           generateId(),
          walletAddress: data.walletAddress,
          state:         "entering",
          hp,
          maxHp:         hp,
          position:      { x: 0.5, y: 0.5 },
          basePosition:  { x: 0.5, y: 0.5 },
          isEliminated:  false,
          flipped:       false,
          animKey:       0,
        }

        const all   = [...prev, newFighter]
        const alive = all.filter((f) => !f.isEliminated)
        return all.map((f) => {
          if (f.isEliminated) return f
          const idx    = alive.findIndex((a) => a.id === f.id)
          const pos    = getCirclePosition(idx, alive.length)
          return { ...f, basePosition: pos, position: pos }
        })
      })

      pushFeedEvent(setFeedEvents, "join", data.walletAddress)
    })

    // ── live-purchase (optimistic spawn — show instantly) ─────────────────────
    s.on("live-purchase", (data: { buyer: string; buyerShort?: string; amount: number; canJoin: boolean; timestamp: string }) => {
      // Always add to feed for instant visibility
      pushFeedEvent(setFeedEvents, "join", data.buyer)

      if (!data.canJoin) return

      setFighters((prev) => {
        if (prev.find((f) => f.walletAddress === data.buyer)) return prev
        if (fightActiveRef.current) return prev

        const hp         = getHpFromTokens(data.amount ?? 0)
        const optimistic: Fighter = {
          id:           generateId(),
          walletAddress: data.buyer,
          state:         "entering",
          hp,
          maxHp:         hp,
          position:      { x: 0.5, y: 0.5 },
          basePosition:  { x: 0.5, y: 0.5 },
          isEliminated:  false,
          flipped:       false,
          animKey:       0,
        }

        const all   = [...prev, optimistic]
        const alive = all.filter((f) => !f.isEliminated)
        return all.map((f) => {
          if (f.isEliminated) return f
          const idx = alive.findIndex((a) => a.id === f.id)
          const pos = getCirclePosition(idx, alive.length)
          return { ...f, basePosition: pos, position: pos }
        })
      })
    })

    // ── participant-removed (token sell) ───────────────────────────────────
    s.on("participant-removed", (data: { walletAddress: string }) => {
      setFighters((prev) => {
        const filtered = prev.filter((f) => f.walletAddress !== data.walletAddress)
        return rebuildPositions(filtered)
      })
      pushFeedEvent(setFeedEvents, "sell", data.walletAddress)
    })

    // ── fight-started ──────────────────────────────────────────────────────
    s.on(
      "fight-started",
      (data: {
        roundId?: number
        participantCount?: number
        participants?: Array<{ walletAddress: string; tokenAmount: number }>
      }) => {
        setBattlePhase("battle")
        pushFeedEvent(setFeedEvents, "round_start", "arena", String(roundRef.current))

        // Authoritative sync: merge backend participant list with current fighters.
        // This ensures every fighter the backend knows about is present on screen,
        // even if some live-purchase socket events were missed.
        if (data.participants && data.participants.length > 0) {
          setFighters((prev) => {
            const merged = data.participants!.map((p) => {
              const existing = prev.find((f) => f.walletAddress === p.walletAddress)
              if (existing) return { ...existing, state: "idle" as const }
              const hp = getHpFromTokens(p.tokenAmount ?? 0)
              return {
                id:           generateId(),
                walletAddress: p.walletAddress,
                state:         "entering" as const,
                hp,
                maxHp:         hp,
                position:      { x: 0.5, y: 0.5 },
                basePosition:  { x: 0.5, y: 0.5 },
                isEliminated:  false,
                flipped:       false,
                animKey:       0,
              } satisfies Fighter
            })
            const alive = merged.filter((f) => !f.isEliminated)
            return merged.map((f) => {
              if (f.isEliminated) return f
              const idx = alive.findIndex((a) => a.id === f.id)
              const pos = getCirclePosition(idx, alive.length)
              return { ...f, basePosition: pos, position: pos, state: "idle" as const }
            })
          })
        } else {
          // Fallback: just reset states if no participant list provided
          setFighters((prev) => prev.map((f) => ({ ...f, state: "idle" as const })))
        }

        startLocalFightAnimation()
      },
    )

    // ── battle-result ──────────────────────────────────────────────────────
    s.on("battle-result", (data: { winner: string; round: number }) => {
      // Stop local animation
      fightActiveRef.current = false
      if (battleIntervalRef.current) {
        clearInterval(battleIntervalRef.current)
        battleIntervalRef.current = null
      }

      // Mark real winner, eliminate everyone else
      setFighters((prev) => {
        const winnerFighter = prev.find((f) => f.walletAddress === data.winner)
        if (winnerFighter) {
          setWinnerId(winnerFighter.id)
        }
        return prev.map((f) => ({
          ...f,
          state:       (f.walletAddress === data.winner ? "victory" : "dead") as Fighter["state"],
          hp:           f.walletAddress === data.winner ? f.maxHp : 0,
          isEliminated: f.walletAddress !== data.winner,
          position:     f.basePosition,
        }))
      })

      setWinnerWallet(data.winner)
      setShowWinnerPopup(true)
      setBattlePhase("finished")
      pushFeedEvent(setFeedEvents, "win", data.winner)
      setTotalRoundsCompleted((r) => r + 1)

      if (celebrationTimer.current) clearTimeout(celebrationTimer.current)
      celebrationTimer.current = setTimeout(() => setShowWinnerPopup(false), 7000)
    })

    // ── leaderboard-update ────────────────────────────────────────────────
    // Backend emits array directly; REST returns { rankings: [...] }
    s.on("leaderboard-update", (data: Array<{ walletAddress: string; wins: number }> | { rankings?: Array<{ walletAddress: string; wins: number }> }) => {
      const list = Array.isArray(data) ? data : (data?.rankings ?? [])
      if (list.length === 0) return
      const mapped: LeaderboardEntry[] = list.map((entry, i) => ({
        rank:              i + 1,
        walletAddress:     entry.walletAddress,
        roundsWon:         entry.wins ?? 0,
        totalEliminations: 0,
      }))
      setLeaderboard(mapped)
    })

    // ── Fetch initial leaderboard via REST ────────────────────────────────
    fetch(`${SOCKET_URL}/api/leaderboard`)
      .then((r) => r.json())
      .then((data) => {
        const rankings = data?.rankings ?? data?.leaderboard ?? []
        if (Array.isArray(rankings) && rankings.length > 0) {
          setLeaderboard(
            rankings.map((e: { walletAddress: string; wins: number }, i: number) => ({
              rank:              i + 1,
              walletAddress:     e.walletAddress,
              roundsWon:         e.wins ?? 0,
              totalEliminations: 0,
            }))
          )
        }
      })
      .catch(() => {/* leaderboard is optional on load */})

    return () => {
      s.disconnect()
      fightActiveRef.current = false
      if (battleIntervalRef.current) clearInterval(battleIntervalRef.current)
      if (celebrationTimer.current)  clearTimeout(celebrationTimer.current)
    }
  }, [startLocalFightAnimation]) // startLocalFightAnimation is stable (useCallback with [])

  const handleLotteryComplete = useCallback((winners: string[]) => {
    setGrandWinners(winners)
    winners.forEach((w) => pushFeedEvent(setFeedEvents, "win", w, "Grand Winner"))
  }, [])

  const handleWinnerClose = useCallback(() => {
    setShowWinnerPopup(false)
  }, [])

  return {
    fighters,
    battlePhase,
    countdown,
    round,
    feedEvents,
    leaderboard,
    grandWinners,
    winnerId,
    winnerWallet,
    showWinnerPopup,
    totalRoundsCompleted,
    handleLotteryComplete,
    handleWinnerClose,
    isLotteryEligible: totalRoundsCompleted >= 10,
  }
}
