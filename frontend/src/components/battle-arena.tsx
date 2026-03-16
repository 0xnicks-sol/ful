"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { GladiatorCharacter, type GladiatorState } from "@/components/gladiator-character"

export interface Fighter {
  id: string
  walletAddress: string
  state: GladiatorState
  hp: number
  maxHp: number
  position: { x: number; y: number }
  basePosition: { x: number; y: number }
  isEliminated: boolean
  flipped?: boolean
  animKey?: number
}

interface BattleArenaProps {
  fighters: Fighter[]
  battlePhase: "lobby" | "battle" | "finished"
  round: number
  winnerId?: string
  onWinnerClose?: () => void
  showWinnerPopup?: boolean
  winnerWallet?: string
}

function EmberParticle({ style }: { style: React.CSSProperties }) {
  return (
    <div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: 3,
        height: 3,
        background: "radial-gradient(circle, #ffcc44, #ff6600)",
        animation: `ember-rise ${1.5 + Math.random() * 2}s ease-out forwards`,
        ...style,
      }}
    />
  )
}

function Torch({ x, y }: { x: number; y: number }) {
  const [embers, setEmbers] = useState<number[]>([])
  const counterRef = useRef(0)
  useEffect(() => {
    const interval = setInterval(() => {
      counterRef.current += 1
      setEmbers((prev) => [...prev.slice(-6), counterRef.current])
    }, 400)
    return () => clearInterval(interval)
  }, [])
  return (
    <div className="absolute" style={{ left: x, top: y, transform: "translate(-50%, -100%)" }}>
      <div style={{ width: 6, height: 28, background: "linear-gradient(to bottom, #5a3d1a, #2a1a08)", borderRadius: "3px 3px 0 0", margin: "0 auto" }} />
      <div className="absolute -top-5 left-1/2 -translate-x-1/2" style={{ width: 14, height: 20, background: "radial-gradient(ellipse at bottom, #ffcc00 0%, #ff6600 50%, transparent 100%)", borderRadius: "50% 50% 30% 30%", filter: "blur(1px)", animation: "fighter-idle 0.8s ease-in-out infinite" }} />
      <div className="absolute -top-3 left-1/2 -translate-x-1/2" style={{ width: 8, height: 12, background: "radial-gradient(ellipse at bottom, #ffffff 0%, #ffcc00 60%, transparent 100%)", borderRadius: "50% 50% 30% 30%", filter: "blur(0.5px)" }} />
      {embers.map((id) => (
        <EmberParticle key={id} style={{ bottom: "100%", left: `${Math.random() * 14 - 3}px`, "--drift": `${(Math.random() - 0.5) * 30}px` } as React.CSSProperties} />
      ))}
    </div>
  )
}

function HPBar({ hp, max }: { hp: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (hp / max) * 100))
  const color = pct > 60 ? "#22c55e" : pct > 30 ? "#f59e0b" : "#ef4444"
  return (
    <div style={{ width: 52, height: 5, background: "rgba(0,0,0,0.7)", borderRadius: 3, border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.35s ease, background 0.25s ease", boxShadow: `0 0 5px ${color}` }} />
    </div>
  )
}

function ClashEffect({ x, y }: { x: number; y: number }) {
  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: x, top: y, zIndex: 40, width: 48, height: 48, animation: "clash-burst 0.45s ease-out forwards" }}
    >
      {Array.from({ length: 10 }).map((_, i) => {
        const angle = (i / 10) * 360
        const len = 10 + Math.random() * 12
        return (
          <div
            key={i}
            className="absolute"
            style={{
              width: len, height: 2,
              background: i % 2 === 0
                ? "linear-gradient(to right, #fff8a0, transparent)"
                : "linear-gradient(to right, #ffcc00, transparent)",
              top: "50%", left: "50%",
              transformOrigin: "0 50%",
              transform: `rotate(${angle}deg) translateY(-50%)`,
            }}
          />
        )
      })}
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(255,240,80,0.9) 0%, rgba(255,160,20,0.5) 40%, transparent 70%)", filter: "blur(3px)" }}
      />
    </div>
  )
}

function WinnerPopup({ wallet, round, onClose }: { wallet: string; round: number; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 7000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="flex flex-col items-center gap-5 rounded-3xl p-8 text-center"
        style={{
          background: "linear-gradient(145deg, #0e0a02, #1a1208)",
          border: "2px solid #c9a227",
          boxShadow: "0 0 80px rgba(201,162,39,0.5), 0 0 140px rgba(201,162,39,0.2), inset 0 0 40px rgba(201,162,39,0.06)",
          maxWidth: 420,
          width: "90vw",
          animation: "enter-arena 0.6s cubic-bezier(0.175,0.885,0.32,1.275) both",
        }}
      >
        <div style={{ fontSize: 40, lineHeight: 1, filter: "drop-shadow(0 0 12px rgba(255,215,0,0.7))" }} aria-hidden>
          &#127807;
        </div>
        <div>
          <p className="text-xs font-mono tracking-widest uppercase mb-2" style={{ color: "#8a7a55" }}>
            Round {round} Complete
          </p>
          <h2 className="text-3xl font-bold tracking-widest uppercase" style={{ fontFamily: "Georgia,serif", color: "#c9a227", lineHeight: 1.2, textShadow: "0 0 30px rgba(201,162,39,0.5)" }}>
            Victory!
          </h2>
          <p className="text-sm font-mono mt-1" style={{ color: "#f0e6c8" }}>The last gladiator stands</p>
        </div>
        <div style={{ width: "100%", height: 1, background: "linear-gradient(to right, transparent, rgba(201,162,39,0.6), transparent)" }} />
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-mono tracking-widest uppercase" style={{ color: "#8a7a55" }}>Winner</p>
          <div className="px-4 py-2 rounded-xl font-mono text-sm font-bold" style={{ background: "rgba(201,162,39,0.1)", border: "1px solid rgba(201,162,39,0.4)", color: "#ffd700", wordBreak: "break-all", textShadow: "0 0 14px rgba(255,215,0,0.5)" }}>
            {wallet}
          </div>
        </div>
        <div className="flex gap-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ fontSize: 18, animation: `countdown-pulse ${0.8 + i * 0.2}s ease-in-out infinite`, color: "#ffd700", filter: "drop-shadow(0 0 6px rgba(255,215,0,0.8))" }}>
              &#9733;
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          className="px-6 py-2 rounded-xl text-xs font-mono tracking-widest uppercase transition-all duration-200"
          style={{ background: "rgba(201,162,39,0.15)", border: "1px solid rgba(201,162,39,0.5)", color: "#c9a227" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(201,162,39,0.28)" }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(201,162,39,0.15)" }}
        >
          Continue
        </button>
      </div>
    </div>
  )
}

export function BattleArena({ fighters, battlePhase, round, winnerId, showWinnerPopup, winnerWallet, onWinnerClose }: BattleArenaProps) {
  const arenaRef = useRef<HTMLDivElement>(null)
  const [arenaSize, setArenaSize] = useState(680)
  const [flashElimination, setFlashElimination] = useState(false)
  const [clashes, setClashes] = useState<{ id: number; x: number; y: number }[]>([])
  const clashCounterRef = useRef(0)
  const prevAliveRef = useRef(fighters.length)

  useEffect(() => {
    const update = () => {
      if (arenaRef.current?.parentElement) {
        const w = arenaRef.current.parentElement.clientWidth
        setArenaSize(Math.min(w - 16, 720))
      }
    }
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  const aliveCount = fighters.filter((f) => !f.isEliminated).length
  useEffect(() => {
    if (aliveCount < prevAliveRef.current && battlePhase === "battle") {
      setFlashElimination(true)
      setTimeout(() => setFlashElimination(false), 600)
    }
    prevAliveRef.current = aliveCount
  }, [aliveCount, battlePhase])

  const spawnClash = useCallback((ax: number, ay: number, vx: number, vy: number) => {
    const mx = ((ax + vx) / 2) * arenaSize
    const my = ((ay + vy) / 2) * arenaSize
    const id = ++clashCounterRef.current
    setClashes((prev) => [...prev.slice(-5), { id, x: mx, y: my }])
    setTimeout(() => setClashes((prev) => prev.filter((c) => c.id !== id)), 500)
  }, [arenaSize])

  useEffect(() => {
    if (battlePhase !== "battle") return
    const attacker = fighters.find((f) => f.state === "attack" && !f.isEliminated)
    const victim = fighters.find((f) => f.state === "hit" && !f.isEliminated)
    if (attacker && victim) {
      spawnClash(attacker.position.x, attacker.position.y, victim.basePosition.x, victim.basePosition.y)
    }
  }, [fighters, battlePhase, spawnClash])

  const arenaRadius = arenaSize / 2

  const torchPositions = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2 - Math.PI / 2
    const r = arenaRadius * 0.925
    return {
      x: arenaRadius + Math.cos(angle) * r,
      y: arenaRadius + Math.sin(angle) * r,
    }
  })

  const gladiatorSize = arenaSize < 500 ? 54 : arenaSize < 640 ? 64 : 72

  return (
    <>
      {showWinnerPopup && winnerWallet && (
        <WinnerPopup wallet={winnerWallet} round={round - 1} onClose={onWinnerClose ?? (() => {})} />
      )}

      <div className="relative flex flex-col items-center w-full">
        {/* Status badges */}
        <div className="flex items-center gap-3 mb-3 flex-wrap justify-center">
          <div className="glass-card px-4 py-1.5 rounded-full flex items-center gap-2" style={{ border: "1px solid rgba(201,162,39,0.4)" }}>
            <span className="text-xs text-sand-dim font-mono tracking-widest uppercase">Round</span>
            <span className="text-gold font-mono font-bold text-lg">{round}</span>
          </div>
          <div
            className="glass-card px-4 py-1.5 rounded-full flex items-center gap-2"
            style={{ border: `1px solid ${battlePhase === "battle" ? "rgba(204,17,17,0.6)" : "rgba(201,162,39,0.3)"}` }}
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background: battlePhase === "battle" ? "#cc1111" : battlePhase === "lobby" ? "#c9a227" : "#22c55e",
                boxShadow: `0 0 8px ${battlePhase === "battle" ? "#cc1111" : battlePhase === "lobby" ? "#c9a227" : "#22c55e"}`,
                animation: battlePhase === "battle" ? "pulse-crimson 1s infinite" : "none",
              }}
            />
            <span
              className="text-xs font-mono tracking-widest uppercase"
              style={{ color: battlePhase === "battle" ? "#cc1111" : battlePhase === "lobby" ? "#c9a227" : "#22c55e" }}
            >
              {battlePhase === "lobby" ? "Waiting" : battlePhase === "battle" ? "Live" : "Finished"}
            </span>
          </div>
          <div className="glass-card px-3 py-1.5 rounded-full" style={{ border: "1px solid rgba(201,162,39,0.3)" }}>
            <span className="text-xs text-sand-dim font-mono">{aliveCount} / {fighters.length} alive</span>
          </div>
        </div>

        {/* Arena */}
        <div ref={arenaRef} className="relative" style={{ width: arenaSize, height: arenaSize }}>
          {flashElimination && (
            <div className="absolute inset-0 rounded-full pointer-events-none z-20" style={{ animation: "elimination-flash 0.6s ease-out forwards" }} />
          )}

          <div className="absolute inset-0 rounded-full" style={{ border: "2px solid rgba(201,162,39,0.1)", boxShadow: "0 0 60px rgba(201,162,39,0.08)" }} />
          <div className="absolute rounded-full" style={{ inset: 4, border: "1px solid transparent", borderTopColor: "rgba(201,162,39,0.5)", borderRightColor: "rgba(201,162,39,0.2)", borderBottomColor: "rgba(201,162,39,0.5)", borderLeftColor: "rgba(201,162,39,0.2)", animation: "ring-rotate 8s linear infinite" }} />
          <div className="absolute rounded-full" style={{ inset: 14, border: "1px dashed rgba(201,162,39,0.18)", animation: "ring-rotate-reverse 12s linear infinite" }} />

          {/* Floor */}
          <div className="absolute rounded-full" style={{ inset: 22, background: "radial-gradient(circle at 40% 35%, #2a1e0e 0%, #1a1008 40%, #0e0905 100%)", border: "3px solid rgba(201,162,39,0.35)", boxShadow: "inset 0 0 80px rgba(0,0,0,0.9), 0 0 80px rgba(201,162,39,0.12)" }} />
          <div className="absolute rounded-full" style={{ inset: 32, background: "radial-gradient(ellipse at 40% 35%, #3d2e18 0%, #2a1e0e 50%, #1a1208 100%)" }} />
          <div className="absolute rounded-full" style={{ inset: 44, border: "1px solid rgba(201,162,39,0.08)" }} />
          <div className="absolute rounded-full" style={{ inset: 80, border: "1px solid rgba(201,162,39,0.06)" }} />

          {/* Centre emblem */}
          <div className="absolute rounded-full flex items-center justify-center" style={{ width: 56, height: 56, top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "radial-gradient(circle, rgba(201,162,39,0.12), transparent)", border: "1px solid rgba(201,162,39,0.22)" }}>
            <span style={{ color: "rgba(201,162,39,0.28)", fontSize: 26 }}>&#9876;</span>
          </div>

          {/* Blood splatters during battle */}
          {battlePhase === "battle" && (
            <>
              <div className="absolute rounded-full" style={{ width: 10, height: 10, background: "rgba(139,0,0,0.4)", top: "35%", left: "60%", filter: "blur(1.5px)" }} />
              <div className="absolute rounded-full" style={{ width: 6, height: 6, background: "rgba(139,0,0,0.3)", top: "65%", left: "28%", filter: "blur(1px)" }} />
              <div className="absolute rounded-full" style={{ width: 4, height: 4, background: "rgba(139,0,0,0.25)", top: "50%", left: "75%", filter: "blur(1px)" }} />
            </>
          )}

          {clashes.map((clash) => (
            <ClashEffect key={clash.id} x={clash.x} y={clash.y} />
          ))}

          {torchPositions.map((pos, i) => (
            <Torch key={i} x={pos.x} y={pos.y} />
          ))}

          {/* Fighters */}
          {fighters.map((fighter) => {
            const isAttacking = fighter.state === "attack"
            const isDead = fighter.isEliminated
            const isWinner = fighter.id === winnerId

            const transitionDuration = isAttacking ? "0.3s" : isDead ? "0.1s" : "0.8s"
            const transitionEase = isAttacking ? "cubic-bezier(0.4,0,0.2,1)" : "cubic-bezier(0.25,0.46,0.45,0.94)"

            return (
              <div
                key={fighter.id}
                className="absolute"
                style={{
                  left: `${fighter.position.x * 100}%`,
                  top: `${fighter.position.y * 100}%`,
                  transform: "translate(-50%, -50%)",
                  zIndex: isDead ? 1 : isAttacking ? 20 : 10,
                  opacity: isDead ? 0.12 : 1,
                  transition: [
                    `left ${transitionDuration} ${transitionEase}`,
                    `top ${transitionDuration} ${transitionEase}`,
                    "opacity 0.5s ease",
                  ].join(", "),
                  willChange: "left, top",
                }}
              >
                {!isDead && battlePhase === "battle" && (
                  <div className="flex justify-center mb-1">
                    <HPBar hp={fighter.hp} max={fighter.maxHp} />
                  </div>
                )}
                {isWinner && battlePhase === "finished" && (
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 font-mono" style={{ color: "#ffd700", textShadow: "0 0 12px #ffd700", whiteSpace: "nowrap", fontSize: 9, letterSpacing: 2, animation: "float 1.6s ease-in-out infinite" }}>
                    WINNER
                  </div>
                )}
                <GladiatorCharacter
                  walletAddress={fighter.walletAddress}
                  state={isDead ? "dead" : fighter.state}
                  size={gladiatorSize}
                  showName={true}
                  isWinner={isWinner}
                  flipped={fighter.flipped ?? false}
                  animKey={fighter.animKey ?? 0}
                />
              </div>
            )
          })}

          {battlePhase === "finished" && winnerId && (
            <div className="absolute inset-0 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle at center, rgba(201,162,39,0.12) 0%, transparent 65%)" }} />
          )}
        </div>

        {/* Fighter dots strip */}
        <div className="flex items-center gap-2 mt-3 flex-wrap justify-center" style={{ maxWidth: arenaSize }}>
          {fighters.map((f) => (
            <div
              key={f.id}
              className="rounded-full transition-all duration-300"
              title={f.walletAddress}
              style={{
                width: 8, height: 8,
                background: f.isEliminated ? "rgba(139,0,0,0.3)" : "#c9a227",
                boxShadow: f.isEliminated ? "none" : "0 0 6px rgba(201,162,39,0.8)",
                transform: f.isEliminated ? "scale(0.6)" : "scale(1)",
              }}
            />
          ))}
        </div>
      </div>
    </>
  )
}
