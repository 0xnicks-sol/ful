"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Copy, ExternalLink, Sword, Shield, Trophy, UserPlus, UserMinus } from "lucide-react"

export type FeedEventType = "join" | "eliminate" | "sell" | "win" | "round_start" | "round_end"

export interface FeedEvent {
  id: string
  type: FeedEventType
  walletAddress: string
  timestamp: Date
  message?: string
}

function FeedEventIcon({ type }: { type: FeedEventType }) {
  const map: Record<FeedEventType, { icon: React.ReactNode; color: string }> = {
    join:        { icon: <UserPlus className="w-3 h-3" />,  color: "#22c55e" },
    eliminate:   { icon: <Sword className="w-3 h-3" />,     color: "#cc1111" },
    sell:        { icon: <UserMinus className="w-3 h-3" />, color: "#f59e0b" },
    win:         { icon: <Trophy className="w-3 h-3" />,    color: "#e63232" },
    round_start: { icon: <Shield className="w-3 h-3" />,    color: "#4a9eff" },
    round_end:   { icon: <Trophy className="w-3 h-3" />,    color: "#e63232" },
  }
  const { icon, color } = map[type]
  return (
    <span
      className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center"
      style={{ background: `${color}22`, color }}
    >
      {icon}
    </span>
  )
}

function getEventText(event: FeedEvent) {
  const short = `${event.walletAddress.slice(0, 5)}...${event.walletAddress.slice(-4)}`
  switch (event.type) {
    case "join":        return <><span style={{ color: "#22c55e" }}>{short}</span>{" entered the arena"}</>
    case "eliminate":   return <><span style={{ color: "#cc1111" }}>{short}</span>{" was eliminated!"}</>
    case "sell":        return <><span style={{ color: "#f59e0b" }}>{short}</span>{" sold — removed from battle"}</>
    case "win":         return <><span style={{ color: "#e63232" }}>{short}</span>{" wins the round!"}</>
    case "round_start": return <span style={{ color: "#4a9eff" }}>{"Battle begins! Round " + (event.message || "")}</span>
    case "round_end":   return <span style={{ color: "#e63232" }}>{"Round " + (event.message || "") + " concluded"}</span>
  }
}

function timeAgo(date: Date) {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000)
  if (secs < 60) return `${secs}s`
  return `${Math.floor(secs / 60)}m`
}

interface TickerProps {
  events: FeedEvent[]
}

export function LiveTicker({ events }: TickerProps) {
  if (events.length === 0) return null
  const items = [...events, ...events]
  return (
    <div
      className="w-full overflow-hidden py-2"
      style={{
        background: "rgba(0,0,0,0.5)",
        borderTop: "1px solid rgba(230,50,50,0.2)",
        borderBottom: "1px solid rgba(230,50,50,0.2)",
      }}
    >
      <div className="flex items-center whitespace-nowrap gap-8" style={{ width: "max-content", animation: "ticker 30s linear infinite" }}>
        {items.map((event, i) => (
          <div key={`${event.id}-${i}`} className="flex items-center gap-2 text-xs font-mono">
            <FeedEventIcon type={event.type} />
            <span style={{ color: "rgba(240,230,200,0.8)" }}>{getEventText(event)}</span>
            <span style={{ color: "rgba(138,122,85,0.6)" }}>•</span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface LiveFeedPanelProps {
  events: FeedEvent[]
}

export function LiveFeedPanel({ events }: LiveFeedPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [events.length])

  return (
    <div
      className="glass-card rounded-2xl p-4 flex flex-col gap-3"
      style={{ height: 480, minHeight: 480, maxHeight: 480 }}
    >
      <div className="flex items-center gap-2 flex-shrink-0">
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: "#cc1111", boxShadow: "0 0 8px rgba(204,17,17,0.8)", animation: "pulse-crimson 1s infinite" }}
        />
        <span className="text-xs tracking-widest uppercase font-mono text-sand-dim">Live Feed</span>
        <span
          className="ml-auto text-xs font-mono px-2 py-0.5 rounded flex-shrink-0"
          style={{ background: "rgba(204,17,17,0.15)", color: "#cc1111", border: "1px solid rgba(204,17,17,0.3)" }}
        >
          LIVE
        </span>
      </div>

      <div className="flex-shrink-0">
        <span className="text-xs font-mono text-sand-dim">{events.length} events</span>
      </div>

      <div
        ref={scrollRef}
        className="flex flex-col gap-2 overflow-y-auto flex-1"
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(230,50,50,0.3) transparent" }}
      >
        {events.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-8">
            <span className="text-xs text-sand-dim font-mono">Waiting for events...</span>
          </div>
        ) : (
          events.map((event, idx) => (
            <div
              key={event.id}
              className="flex items-start gap-2 rounded-lg p-2 flex-shrink-0 transition-all duration-200"
              style={{
                background:
                  event.type === "eliminate" ? "rgba(204,17,17,0.08)"
                  : event.type === "win"     ? "rgba(230,50,50,0.08)"
                  : event.type === "sell"    ? "rgba(245,158,11,0.08)"
                  : "rgba(255,255,255,0.03)",
                border:
                  event.type === "win"       ? "1px solid rgba(230,50,50,0.2)"
                  : event.type === "eliminate" ? "1px solid rgba(204,17,17,0.15)"
                  : "1px solid transparent",
                animationName:     idx === 0 ? "enter-arena" : "none",
                animationDuration: "0.35s",
                animationFillMode: "both",
              }}
            >
              <FeedEventIcon type={event.type} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono leading-relaxed" style={{ color: "rgba(240,230,200,0.85)" }}>
                  {getEventText(event)}
                </p>
              </div>
              <span className="text-xs font-mono flex-shrink-0 mt-0.5" style={{ color: "rgba(138,122,85,0.55)" }}>
                {timeAgo(event.timestamp)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

interface TokenInfoBarProps {
  tokenName: string
  tokenSymbol: string
  contractAddress: string
  pumpFunUrl: string
  twitterUrl: string
  totalVolume?: string
  totalWinners?: number
}

export function TokenInfoBar({
  tokenName,
  tokenSymbol,
  contractAddress,
  pumpFunUrl,
  twitterUrl,
  totalVolume,
  totalWinners = 0,
}: TokenInfoBarProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(contractAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="w-full flex items-center justify-between gap-4 px-5 py-2.5 flex-wrap"
      style={{
        background: "rgba(10,10,10,0.9)",
        borderBottom: "1px solid rgba(230,50,50,0.25)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0" style={{ border: "1px solid rgba(230,50,50,0.4)" }}>
          <Image
            src="/logoooooo-modified.png"
            alt="ClawBattle"
            width={32}
            height={32}
            className="w-full h-full object-cover"
          />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm text-sand">{tokenName}</span>
            <span
              className="text-xs font-mono px-1.5 py-0.5 rounded"
              style={{ background: "rgba(230,50,50,0.15)", color: "#e63232", border: "1px solid rgba(230,50,50,0.3)" }}
            >
              {tokenSymbol}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs font-mono text-sand-dim">
              {contractAddress.slice(0, 6)}...{contractAddress.slice(-6)}
            </span>
            <button onClick={handleCopy} className="text-sand-dim hover:text-gold transition-colors" aria-label="Copy contract address">
              <Copy className="w-3 h-3" />
            </button>
            {copied && <span className="text-xs font-mono" style={{ color: "#22c55e" }}>Copied!</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {totalVolume && (
          <div className="text-center">
            <p className="text-xs text-sand-dim font-mono">Volume</p>
            <p className="text-sm font-bold font-mono text-gold">{totalVolume}</p>
          </div>
        )}
        <div className="text-center">
          <p className="text-xs text-sand-dim font-mono">Total Winners</p>
          <p className="text-sm font-bold font-mono text-gold">{totalWinners}</p>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "#cc1111", boxShadow: "0 0 6px #cc1111", animation: "pulse-crimson 1s infinite" }}
          />
          <span className="text-xs font-mono" style={{ color: "#cc1111" }}>LIVE</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <a
          href={pumpFunUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all duration-200 hover:opacity-90"
          style={{ background: "rgba(230,50,50,0.15)", border: "1px solid rgba(230,50,50,0.4)", color: "#e63232" }}
        >
          pump.fun
          <ExternalLink className="w-3 h-3" />
        </a>
        <a
          href={twitterUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all duration-200 hover:opacity-90"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#f0f0f0" }}
        >
          X / Twitter
          <ExternalLink className="w-3 h-3" />
        </a>
        <a
          href="https://t.me/ClawBattleAI"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all duration-200 hover:opacity-90"
          style={{ background: "rgba(41,182,246,0.08)", border: "1px solid rgba(41,182,246,0.25)", color: "#29b6f6" }}
        >
          Telegram
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  )
}
