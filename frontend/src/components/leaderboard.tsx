"use client"

import { useState } from "react"
import { Trophy, Crown, Shuffle } from "lucide-react"
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
}

const RANK_COLORS: Record<number, { color: string; bg: string; label: string }> = {
  1: { color: "#ffd700", bg: "rgba(255,215,0,0.1)",    label: "I" },
  2: { color: "#c0c0c0", bg: "rgba(192,192,192,0.08)", label: "II" },
  3: { color: "#cd7f32", bg: "rgba(205,127,50,0.08)",  label: "III" },
}

export function Leaderboard({ entries, onRunLottery, isLotteryEligible, grandWinners = [] }: LeaderboardProps) {
  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4" style={{ color: "#c9a227" }} />
          <span className="text-sm font-bold tracking-widest uppercase font-mono text-gold">Leaderboard</span>
        </div>
        <span className="text-xs font-mono text-sand-dim">{entries.length} entries</span>
      </div>

      {grandWinners.length > 0 && (
        <div className="rounded-xl p-3" style={{ background: "rgba(201,162,39,0.1)", border: "1px solid rgba(201,162,39,0.4)" }}>
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-4 h-4" style={{ color: "#ffd700" }} />
            <span className="text-xs font-bold tracking-widest uppercase font-mono" style={{ color: "#ffd700" }}>
              Grand Winners — 50% Rewards Split
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {grandWinners.map((wallet, i) => (
              <div key={wallet} className="flex items-center gap-2">
                <span className="text-xs font-mono w-5 text-center font-bold" style={{ color: i === 0 ? "#ffd700" : i === 1 ? "#c0c0c0" : "#cd7f32" }}>
                  {i + 1}
                </span>
                <span className="text-xs font-mono text-sand">{wallet.slice(0, 8)}...{wallet.slice(-6)}</span>
                <span className="ml-auto text-xs font-mono px-2 py-0.5 rounded" style={{ background: "rgba(201,162,39,0.2)", color: "#c9a227", border: "1px solid rgba(201,162,39,0.3)" }}>
                  WINNER
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {entries.length === 0 ? (
          <div className="py-8 flex flex-col items-center gap-2">
            <Trophy className="w-8 h-8 opacity-20" style={{ color: "#c9a227" }} />
            <span className="text-xs text-sand-dim font-mono">No winners yet. Battles will begin soon.</span>
          </div>
        ) : (
          entries.map((entry) => {
            const rankStyle = RANK_COLORS[entry.rank] || { color: "#8a7a55", bg: "rgba(138,122,85,0.05)", label: `${entry.rank}` }
            const isGrand = grandWinners.includes(entry.walletAddress)
            return (
              <div
                key={entry.walletAddress}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200"
                style={{
                  background: isGrand ? "rgba(201,162,39,0.1)" : rankStyle.bg,
                  border: isGrand
                    ? "1px solid rgba(201,162,39,0.5)"
                    : entry.rank <= 3
                    ? `1px solid ${rankStyle.color}33`
                    : "1px solid rgba(201,162,39,0.08)",
                }}
              >
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
                <div className="flex-shrink-0">
                  <GladiatorCharacter walletAddress={entry.walletAddress} state="idle" size={32} showName={false} isWinner={isGrand} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-sand truncate">
                    {entry.walletAddress.slice(0, 6)}...{entry.walletAddress.slice(-4)}
                  </p>
                  <p className="text-xs font-mono text-sand-dim">
                    {entry.roundsWon}W · {entry.totalEliminations} kills
                  </p>
                </div>
                {isGrand && <Crown className="w-4 h-4 flex-shrink-0" style={{ color: "#ffd700" }} />}
              </div>
            )
          })
        )}
      </div>

      {isLotteryEligible && entries.length >= 10 && grandWinners.length === 0 && (
        <button
          onClick={onRunLottery}
          className="w-full py-3 rounded-xl text-sm font-bold font-mono tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-2"
          style={{ background: "rgba(201,162,39,0.15)", border: "1px solid rgba(201,162,39,0.5)", color: "#c9a227" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(201,162,39,0.25)"; e.currentTarget.style.boxShadow = "0 0 20px rgba(201,162,39,0.3)" }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(201,162,39,0.15)"; e.currentTarget.style.boxShadow = "none" }}
        >
          <Shuffle className="w-4 h-4" />
          Run Grand Lottery
        </button>
      )}
    </div>
  )
}

interface LotteryWheelProps {
  entries: LeaderboardEntry[]
  onComplete: (winners: string[]) => void
}

export function LotteryWheel({ entries, onComplete }: LotteryWheelProps) {
  const [isSpinning, setIsSpinning] = useState(false)
  const [winners,    setWinners]    = useState<string[]>([])
  const [phase,      setPhase]      = useState<"idle" | "spinning" | "picked" | "done">("idle")
  const [displayWallet, setDisplayWallet] = useState("")

  const runLottery = () => {
    if (isSpinning || entries.length === 0) return
    setIsSpinning(true)
    setPhase("spinning")
    setWinners([])

    const pickWinner = (remainingEntries: LeaderboardEntry[], currentWinners: string[], pickNum: number) => {
      if (pickNum > 3 || remainingEntries.length === 0) {
        setPhase("done")
        setIsSpinning(false)
        onComplete(currentWinners)
        return
      }
      let cycleCount = 0
      const totalCycles = 20 + Math.random() * 15
      const interval = setInterval(() => {
        const randomIdx = Math.floor(Math.random() * remainingEntries.length)
        setDisplayWallet(remainingEntries[randomIdx].walletAddress)
        cycleCount++
        if (cycleCount >= totalCycles) {
          clearInterval(interval)
          const winnerIdx = Math.floor(Math.random() * remainingEntries.length)
          const winner = remainingEntries[winnerIdx]
          setDisplayWallet(winner.walletAddress)
          const newWinners = [...currentWinners, winner.walletAddress]
          setWinners(newWinners)
          setPhase("picked")
          setTimeout(() => {
            const filtered = remainingEntries.filter((e) => e.walletAddress !== winner.walletAddress)
            setPhase("spinning")
            pickWinner(filtered, newWinners, pickNum + 1)
          }, 1800)
        }
      }, 80)
    }

    pickWinner(entries, [], 1)
  }

  return (
    <div className="glass-card rounded-2xl p-6 flex flex-col items-center gap-5">
      <div className="flex items-center gap-2">
        <Crown className="w-5 h-5" style={{ color: "#ffd700" }} />
        <span className="text-sm font-bold tracking-widest uppercase font-mono text-gold">Grand Lottery</span>
      </div>
      <p className="text-xs text-sand-dim font-mono text-center max-w-xs">
        3 grand winners chosen from round winners. Each receives an equal share of 50% of creator rewards.
      </p>

      <div
        className="w-full rounded-xl p-4 flex flex-col items-center gap-2"
        style={{
          background: "rgba(0,0,0,0.4)",
          border: `2px solid ${phase === "picked" ? "rgba(201,162,39,0.6)" : "rgba(201,162,39,0.2)"}`,
          minHeight: 90,
          transition: "border-color 0.3s",
        }}
      >
        {phase === "idle" && <span className="text-xs text-sand-dim font-mono">Click to start the lottery draw</span>}
        {(phase === "spinning" || phase === "picked") && (
          <>
            <span className="text-xs text-sand-dim font-mono tracking-wider">
              {phase === "spinning" ? `Picking winner ${winners.length + 1} of 3...` : `Winner ${winners.length} chosen!`}
            </span>
            <div
              className="font-mono font-bold text-sm text-center"
              style={{
                color: phase === "picked" ? "#ffd700" : "#c9a227",
                textShadow: phase === "picked" ? "0 0 20px rgba(255,215,0,0.7)" : "none",
                animation: phase === "spinning" ? "countdown-pulse 0.15s infinite" : "none",
                wordBreak: "break-all",
              }}
            >
              {displayWallet}
            </div>
          </>
        )}
        {phase === "done" && <span className="text-xs font-mono font-bold" style={{ color: "#22c55e" }}>All 3 winners selected!</span>}
      </div>

      {winners.length > 0 && (
        <div className="w-full flex flex-col gap-2">
          {winners.map((wallet, i) => (
            <div
              key={wallet}
              className="flex items-center gap-2 rounded-lg px-3 py-2"
              style={{ background: "rgba(201,162,39,0.1)", border: "1px solid rgba(201,162,39,0.35)", animation: "enter-arena 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) both" }}
            >
              <span className="font-mono font-bold text-sm w-5 text-center" style={{ color: i === 0 ? "#ffd700" : i === 1 ? "#c0c0c0" : "#cd7f32" }}>{i + 1}</span>
              <Crown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#ffd700" }} />
              <span className="text-xs font-mono text-sand truncate">{wallet.slice(0, 8)}...{wallet.slice(-6)}</span>
            </div>
          ))}
        </div>
      )}

      {phase === "idle" && (
        <button
          onClick={runLottery}
          className="w-full py-3 rounded-xl text-sm font-bold font-mono tracking-wider uppercase transition-all duration-200"
          style={{ background: "rgba(201,162,39,0.2)", border: "1px solid rgba(201,162,39,0.6)", color: "#c9a227", boxShadow: "0 0 20px rgba(201,162,39,0.2)" }}
        >
          Start Lottery Draw
        </button>
      )}
    </div>
  )
}
