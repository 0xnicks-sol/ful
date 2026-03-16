"use client"

import { useEffect, useState } from "react"
import { Trophy, Crown, Shuffle, Swords } from "lucide-react"
import { GladiatorCharacter } from "@/components/gladiator-character"

export interface LeaderboardEntry {
  rank: number
  walletAddress: string
  roundsWon: number
  totalEliminations: number
  isGrandWinner?: boolean
}

interface LeaderboardProps {
  entries: LeaderboardEntry[]
  onRunLottery?: () => void
  isLotteryEligible?: boolean
  grandWinners?: string[]
  totalRoundsCompleted?: number
  totalRounds?: number
}

const RANK_COLORS: Record<number, { color: string; bg: string; label: string }> = {
  1: { color: "#ffffff", bg: "rgba(255,255,255,0.1)",    label: "I" },
  2: { color: "#c0c0c0", bg: "rgba(192,192,192,0.08)", label: "II" },
  3: { color: "#cd7f32", bg: "rgba(205,127,50,0.08)",  label: "III" },
}

export function Leaderboard({
  entries,
  onRunLottery,
  isLotteryEligible,
  grandWinners = [],
  totalRoundsCompleted = 0,
  totalRounds = 10,
}: LeaderboardProps) {
  const progress = Math.min(totalRoundsCompleted, totalRounds)
  const pct      = (progress / totalRounds) * 100

  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4" style={{ color: "#e63232" }} />
          <span className="text-sm font-bold tracking-widest uppercase font-mono text-gold">Leaderboard</span>
        </div>
        <span className="text-xs font-mono text-sand-dim">{entries.length} winner{entries.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Round Progress Bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-sand-dim tracking-wider uppercase">Tournament Progress</span>
          <span className="text-xs font-mono font-bold" style={{ color: progress >= totalRounds ? "#ffffff" : "#e63232" }}>
            {progress >= totalRounds ? "COMPLETE ✓" : `Round ${progress} / ${totalRounds}`}
          </span>
        </div>
        <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: "rgba(230,50,50,0.1)", border: "1px solid rgba(230,50,50,0.15)" }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: progress >= totalRounds
                ? "linear-gradient(90deg, #ffffff, #e63232)"
                : "linear-gradient(90deg, #e63232, #e63232)",
              boxShadow: `0 0 8px rgba(230,50,50,${progress >= totalRounds ? 0.7 : 0.4})`,
            }}
          />
        </div>
        {/* Round pips */}
        <div className="flex gap-1 mt-0.5">
          {Array.from({ length: totalRounds }).map((_, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm transition-all duration-500"
              style={{
                height: 3,
                background: i < progress
                  ? (i < progress && progress >= totalRounds ? "#ffffff" : "#e63232")
                  : "rgba(230,50,50,0.15)",
                boxShadow: i < progress ? "0 0 4px rgba(230,50,50,0.4)" : "none",
              }}
            />
          ))}
        </div>
      </div>

      {/* Grand Winners Banner */}
      {grandWinners.length > 0 && (
        <div
          className="rounded-xl p-3"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.45)" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-4 h-4" style={{ color: "#ffffff" }} />
            <span className="text-xs font-bold tracking-widest uppercase font-mono" style={{ color: "#ffffff" }}>
              Grand Winners — 50% Rewards Split
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {grandWinners.map((wallet, i) => (
              <div key={wallet} className="flex items-center gap-2">
                <span
                  className="text-xs font-mono w-5 text-center font-bold"
                  style={{ color: i === 0 ? "#ffffff" : i === 1 ? "#c0c0c0" : "#cd7f32" }}
                >
                  {i + 1}
                </span>
                <span className="text-xs font-mono text-sand">{wallet.slice(0, 8)}...{wallet.slice(-6)}</span>
                <span
                  className="ml-auto text-xs font-mono px-2 py-0.5 rounded"
                  style={{ background: "rgba(255,255,255,0.15)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.4)" }}
                >
                  WINNER
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Entries list */}
      <div className="flex flex-col gap-2">
        {entries.length === 0 ? (
          <div className="py-8 flex flex-col items-center gap-2">
            <Swords className="w-8 h-8 opacity-20" style={{ color: "#e63232" }} />
            <span className="text-xs text-sand-dim font-mono">No winners yet. Battles will begin soon.</span>
          </div>
        ) : (
          entries.map((entry) => {
            const rankStyle = RANK_COLORS[entry.rank] || { color: "#888888", bg: "rgba(138,122,85,0.05)", label: `${entry.rank}` }
            const isGrand   = grandWinners.includes(entry.walletAddress)
            return (
              <div
                key={entry.walletAddress}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200"
                style={{
                  background: isGrand ? "rgba(255,255,255,0.08)" : rankStyle.bg,
                  border: isGrand
                    ? "1px solid rgba(255,255,255,0.5)"
                    : entry.rank <= 3
                    ? `1px solid ${rankStyle.color}33`
                    : "1px solid rgba(230,50,50,0.08)",
                  boxShadow: isGrand ? "0 0 12px rgba(255,255,255,0.15)" : "none",
                }}
              >
                {/* Rank badge */}
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold font-mono"
                  style={{
                    background:  `${rankStyle.color}22`,
                    color:        rankStyle.color,
                    border:       `1px solid ${rankStyle.color}44`,
                    boxShadow:    entry.rank <= 3 ? `0 0 8px ${rankStyle.color}30` : "none",
                  }}
                >
                  {rankStyle.label}
                </div>
                {/* Avatar */}
                <div className="flex-shrink-0">
                  <GladiatorCharacter walletAddress={entry.walletAddress} state="idle" size={32} showName={false} isWinner={isGrand} />
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-sand truncate">
                    {entry.walletAddress.slice(0, 6)}...{entry.walletAddress.slice(-4)}
                  </p>
                  <p className="text-xs font-mono text-sand-dim">
                    {entry.roundsWon} round win{entry.roundsWon !== 1 ? "s" : ""}
                  </p>
                </div>
                {isGrand && <Crown className="w-4 h-4 flex-shrink-0" style={{ color: "#ffffff" }} />}
              </div>
            )
          })
        )}
      </div>

      {/* Manual lottery trigger (only shown if eligible and not yet run) */}
      {isLotteryEligible && entries.length >= 3 && grandWinners.length === 0 && (
        <button
          onClick={onRunLottery}
          className="w-full py-3 rounded-xl text-sm font-bold font-mono tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-2"
          style={{ background: "rgba(230,50,50,0.15)", border: "1px solid rgba(230,50,50,0.5)", color: "#e63232" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(230,50,50,0.25)"; e.currentTarget.style.boxShadow = "0 0 20px rgba(230,50,50,0.3)" }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(230,50,50,0.15)"; e.currentTarget.style.boxShadow = "none" }}
        >
          <Shuffle className="w-4 h-4" />
          Run Grand Lottery
        </button>
      )}
    </div>
  )
}

// ── Lottery Wheel ─────────────────────────────────────────────────────────────

interface LotteryWheelProps {
  entries: LeaderboardEntry[]
  onComplete: (winners: string[]) => void
  autoStart?: boolean          // true when backend already selected winners
  preselectedWinners?: string[] // winners from backend (skip RNG, just animate)
}

export function LotteryWheel({ entries, onComplete, autoStart = false, preselectedWinners = [] }: LotteryWheelProps) {
  const [isSpinning,    setIsSpinning]    = useState(false)
  const [winners,       setWinners]       = useState<string[]>([])
  const [phase,         setPhase]         = useState<"idle" | "spinning" | "picked" | "done">("idle")
  const [displayWallet, setDisplayWallet] = useState("")

  // Auto-start when backend sends pre-selected winners
  useEffect(() => {
    if (autoStart && preselectedWinners.length > 0 && phase === "idle") {
      runWithPreselected(preselectedWinners)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, preselectedWinners.join(",")])

  const runWithPreselected = (selected: string[]) => {
    if (isSpinning) return
    setIsSpinning(true)
    setPhase("spinning")
    setWinners([])

    const allAddresses = entries.map((e) => e.walletAddress)
    const pool = allAddresses.length > 0 ? allAddresses : selected

    const revealNext = (remaining: string[], picked: string[], idx: number) => {
      if (idx >= selected.length) {
        setPhase("done")
        setIsSpinning(false)
        onComplete(picked)
        return
      }

      let cycleCount = 0
      const totalCycles = 25 + Math.random() * 10
      const interval = setInterval(() => {
        const rIdx = Math.floor(Math.random() * pool.length)
        setDisplayWallet(pool[rIdx])
        cycleCount++
        if (cycleCount >= totalCycles) {
          clearInterval(interval)
          const winner = selected[idx]
          setDisplayWallet(winner)
          const newPicked = [...picked, winner]
          setWinners(newPicked)
          setPhase("picked")
          setTimeout(() => {
            setPhase("spinning")
            revealNext(remaining.filter((w) => w !== winner), newPicked, idx + 1)
          }, 2000)
        }
      }, 70)
    }

    revealNext(selected, [], 0)
  }

  const runManualLottery = () => {
    if (isSpinning || entries.length === 0) return
    setIsSpinning(true)
    setPhase("spinning")
    setWinners([])

    const pickNext = (remaining: LeaderboardEntry[], picked: string[], num: number) => {
      if (num > 3 || remaining.length === 0) {
        setPhase("done")
        setIsSpinning(false)
        onComplete(picked)
        return
      }
      let cycleCount = 0
      const totalCycles = 22 + Math.random() * 12
      const interval = setInterval(() => {
        const rIdx = Math.floor(Math.random() * remaining.length)
        setDisplayWallet(remaining[rIdx].walletAddress)
        cycleCount++
        if (cycleCount >= totalCycles) {
          clearInterval(interval)
          const winnerIdx = Math.floor(Math.random() * remaining.length)
          const winner    = remaining[winnerIdx]
          setDisplayWallet(winner.walletAddress)
          const newPicked = [...picked, winner.walletAddress]
          setWinners(newPicked)
          setPhase("picked")
          setTimeout(() => {
            setPhase("spinning")
            pickNext(remaining.filter((e) => e.walletAddress !== winner.walletAddress), newPicked, num + 1)
          }, 1800)
        }
      }, 80)
    }

    pickNext(entries, [], 1)
  }

  return (
    <div className="glass-card rounded-2xl p-6 flex flex-col items-center gap-5">
      {/* Title */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5" style={{ color: "#ffffff" }} />
          <span className="text-sm font-bold tracking-widest uppercase font-mono text-gold">Grand Lottery</span>
        </div>
        <p className="text-xs text-sand-dim font-mono text-center max-w-xs">
          3 random winners chosen from all {entries.length} round winners — each gets an equal share of 50% creator rewards.
        </p>
      </div>

      {/* Spinning display */}
      <div
        className="w-full rounded-xl p-4 flex flex-col items-center gap-2"
        style={{
          background:  "rgba(0,0,0,0.4)",
          border:      `2px solid ${phase === "picked" ? "rgba(255,255,255,0.7)" : "rgba(230,50,50,0.2)"}`,
          minHeight:   100,
          transition:  "border-color 0.3s",
          boxShadow:   phase === "picked" ? "0 0 30px rgba(255,255,255,0.2)" : "none",
        }}
      >
        {phase === "idle" && (
          <span className="text-xs text-sand-dim font-mono mt-4">
            {autoStart ? "Preparing lottery draw..." : "Click below to start the lottery draw"}
          </span>
        )}
        {(phase === "spinning" || phase === "picked") && (
          <>
            <span className="text-xs text-sand-dim font-mono tracking-wider">
              {phase === "spinning"
                ? `Picking winner ${winners.length + 1} of 3...`
                : `🎉 Winner ${winners.length} selected!`}
            </span>
            <div
              className="font-mono font-bold text-sm text-center px-2"
              style={{
                color:       phase === "picked" ? "#ffffff" : "#e63232",
                textShadow:  phase === "picked" ? "0 0 24px rgba(255,255,255,0.8)" : "none",
                animation:   phase === "spinning" ? "countdown-pulse 0.15s infinite" : "none",
                wordBreak:   "break-all",
                transition:  "color 0.3s, text-shadow 0.3s",
              }}
            >
              {displayWallet}
            </div>
          </>
        )}
        {phase === "done" && (
          <span className="text-sm font-mono font-bold mt-4" style={{ color: "#22c55e" }}>
            ✅ All 3 grand winners selected!
          </span>
        )}
      </div>

      {/* Winners so far */}
      {winners.length > 0 && (
        <div className="w-full flex flex-col gap-2">
          {winners.map((wallet, i) => (
            <div
              key={wallet}
              className="flex items-center gap-2 rounded-lg px-3 py-2"
              style={{
                background: "rgba(230,50,50,0.1)",
                border:     "1px solid rgba(230,50,50,0.35)",
                animation:  "enter-arena 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) both",
                boxShadow:  i === 0 ? "0 0 12px rgba(255,255,255,0.2)" : "none",
              }}
            >
              <span className="font-mono font-bold text-sm w-5 text-center" style={{ color: i === 0 ? "#ffffff" : i === 1 ? "#c0c0c0" : "#cd7f32" }}>
                {i + 1}
              </span>
              <Crown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: i === 0 ? "#ffffff" : i === 1 ? "#c0c0c0" : "#cd7f32" }} />
              <span className="text-xs font-mono text-sand truncate">{wallet.slice(0, 8)}...{wallet.slice(-6)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Start button (only for manual trigger) */}
      {phase === "idle" && !autoStart && (
        <button
          onClick={runManualLottery}
          className="w-full py-3 rounded-xl text-sm font-bold font-mono tracking-wider uppercase transition-all duration-200"
          style={{ background: "rgba(230,50,50,0.2)", border: "1px solid rgba(230,50,50,0.6)", color: "#e63232", boxShadow: "0 0 20px rgba(230,50,50,0.2)" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(230,50,50,0.3)" }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(230,50,50,0.2)" }}
        >
          Start Lottery Draw
        </button>
      )}
    </div>
  )
}
