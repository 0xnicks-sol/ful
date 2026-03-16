"use client"

import { useEffect, useRef } from "react"
import { GladiatorCharacter } from "@/components/gladiator-character"
import type { Fighter } from "@/components/battle-arena"

interface LobbyCountdownProps {
  timeRemaining: number
  totalTime: number
  fighters: Fighter[]
  maxFighters: number
  onBattleStart?: () => void
}

export function LobbyCountdown({ timeRemaining, totalTime, fighters, maxFighters }: LobbyCountdownProps) {
  const progress = (timeRemaining / totalTime) * 100
  const circumference = 2 * Math.PI * 52
  const strokeDashoffset = circumference * (1 - progress / 100)
  const isUrgent = timeRemaining <= 10

  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-4" style={{ minWidth: 220 }}>
      <div className="flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full"
          style={{ background: "#e63232", boxShadow: "0 0 8px rgba(230,50,50,0.8)", animation: "pulse-gold 1.5s infinite" }}
        />
        <span className="text-xs tracking-widest uppercase font-mono text-sand-dim">Battle Starting</span>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="relative" style={{ width: 120, height: 120 }}>
          <svg width="120" height="120" viewBox="0 0 120 120" className="absolute inset-0" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(230,50,50,0.1)" strokeWidth="6" />
            <circle
              cx="60" cy="60" r="52" fill="none"
              stroke={isUrgent ? "#cc1111" : "#e63232"}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s ease", filter: `drop-shadow(0 0 6px ${isUrgent ? "#cc1111" : "#e63232"})` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="font-mono font-bold leading-none"
              style={{
                fontSize: 38,
                color: isUrgent ? "#ff2e2e" : "#e63232",
                textShadow: `0 0 20px ${isUrgent ? "rgba(255,46,46,0.7)" : "rgba(230,50,50,0.6)"}`,
                animation: isUrgent ? "countdown-pulse 0.5s ease-in-out infinite" : "none",
              }}
            >
              {timeRemaining}
            </span>
            <span className="text-xs text-sand-dim font-mono mt-0.5">secs</span>
          </div>
        </div>

        <div className="text-center">
          <span className="text-2xl font-bold font-mono" style={{ color: "#e63232" }}>{fighters.length}</span>
          <span className="text-sand-dim font-mono text-sm"> / {maxFighters}</span>
          <p className="text-xs text-sand-dim mt-0.5 tracking-wide">Gladiators Entered</p>
        </div>
      </div>

      <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
        {Array.from({ length: maxFighters }, (_, i) => {
          const filled = i < fighters.length
          return (
            <div
              key={i}
              className="rounded transition-all duration-300"
              style={{
                height: 8,
                background: filled ? "rgba(230,50,50,0.8)" : "rgba(230,50,50,0.1)",
                border: filled ? "1px solid rgba(230,50,50,0.6)" : "1px solid rgba(230,50,50,0.15)",
                boxShadow: filled ? "0 0 4px rgba(230,50,50,0.4)" : "none",
                transform: filled ? "scaleY(1.2)" : "scaleY(1)",
              }}
            />
          )
        })}
      </div>

      {isUrgent && (
        <div
          className="text-center text-xs font-mono tracking-widest uppercase"
          style={{ color: "#ff2e2e", animation: "countdown-pulse 0.5s ease-in-out infinite" }}
        >
          Battle imminent!
        </div>
      )}
    </div>
  )
}

interface FighterRosterProps {
  fighters: Fighter[]
}

export function FighterRoster({ fighters }: FighterRosterProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ left: scrollRef.current.scrollWidth, behavior: "smooth" })
    }
  }, [fighters.length])

  if (fighters.length === 0) return null

  return (
    <div className="glass-card rounded-2xl p-4 w-full">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs tracking-widest uppercase font-mono text-sand-dim">Entered Gladiators</span>
        <span className="text-xs font-mono text-gold">{fighters.length} fighters</span>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2"
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(230,50,50,0.3) transparent" }}
      >
        {fighters.map((fighter, idx) => (
          <div
            key={fighter.id}
            className="flex-shrink-0 flex flex-col items-center gap-1.5 rounded-xl p-2 transition-all duration-300"
            style={{
              background: fighter.isEliminated ? "rgba(139,0,0,0.15)" : "rgba(230,50,50,0.06)",
              border: fighter.isEliminated ? "1px solid rgba(139,0,0,0.3)" : "1px solid rgba(230,50,50,0.2)",
              opacity: fighter.isEliminated ? 0.5 : 1,
              animationName: "enter-arena",
              animationDuration: "0.5s",
              animationDelay: `${idx * 0.05}s`,
              animationFillMode: "both",
            }}
          >
            <GladiatorCharacter
              walletAddress={fighter.walletAddress}
              state={fighter.isEliminated ? "dead" : "idle"}
              size={48}
              showName={true}
            />
            {fighter.isEliminated && (
              <span className="text-xs font-mono tracking-wider" style={{ color: "#ff2e2e", fontSize: 9 }}>ELIMINATED</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

interface BattleStatsProps {
  fighters: Fighter[]
  round: number
}

export function BattleStats({ fighters, round }: BattleStatsProps) {
  const alive = fighters.filter((f) => !f.isEliminated).length
  const eliminated = fighters.filter((f) => f.isEliminated).length

  return (
    <div className="glass-card rounded-2xl p-4 flex flex-col gap-3">
      <span className="text-xs tracking-widest uppercase font-mono text-sand-dim">Battle Stats</span>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Round",  value: round,      color: "#e63232" },
          { label: "Alive",  value: alive,      color: "#22c55e" },
          { label: "Fallen", value: eliminated, color: "#cc1111" },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col items-center gap-1 rounded-xl p-2" style={{ background: "rgba(0,0,0,0.3)" }}>
            <span className="font-mono font-bold text-2xl leading-none" style={{ color: stat.color, textShadow: `0 0 12px ${stat.color}60` }}>
              {stat.value}
            </span>
            <span className="text-xs text-sand-dim font-mono">{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
