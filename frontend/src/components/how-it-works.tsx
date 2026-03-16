"use client"

import { ShoppingCart, Sword, Clock, Trophy, Shuffle, Gift, Zap } from "lucide-react"

const STEPS = [
  {
    number: "01",
    icon: ShoppingCart,
    title: "Buy The Token",
    description:
      "Purchase the CLAW token on pump.fun. Each buy automatically spawns your fighter and enters you into the next ClawBattle round.",
    color: "#e63232",
  },
  {
    number: "02",
    icon: Clock,
    title: "60s Lobby",
    description:
      "Up to 30 fighters can join each round. A 60-second countdown (starts on first buy) gives everyone time to enter before battle begins.",
    color: "#4a9eff",
  },
  {
    number: "03",
    icon: Sword,
    title: "Battle Begins",
    description:
      "Fighters clash in the arena. Hold your tokens to stay in — sell at any time and your fighter is instantly removed from the battle.",
    color: "#cc1111",
  },
  {
    number: "04",
    icon: Trophy,
    title: "Last One Standing",
    description:
      "The last fighter standing wins the round and earns a spot on the leaderboard. Exactly 10 rounds are played per ClawBattle tournament.",
    color: "#22c55e",
  },
  {
    number: "05",
    icon: Shuffle,
    title: "Grand Lottery",
    description:
      "After all 10 rounds, ClawBattle automatically shuffles all round winners and randomly selects 3 grand prize winners.",
    color: "#bf7fff",
  },
  {
    number: "06",
    icon: Gift,
    title: "Claim Rewards",
    description:
      "The 3 grand winners each receive an equal share of 50% of all pump.fun creator rewards. Winners announced on X.",
    color: "#ff9f3f",
  },
]

export function HowItWorks() {
  return (
    <section className="w-full px-5 py-14">
      {/* Header */}
      <div className="text-center mb-10">
        <h2
          className="text-3xl font-bold tracking-widest uppercase mb-3 text-balance"
          style={{
            fontFamily: "Georgia, serif",
            color: "#e63232",
            textShadow: "0 0 30px rgba(230,50,50,0.4)",
          }}
        >
          How ClawBattle Works
        </h2>
        <p className="text-sand-dim font-mono text-sm max-w-lg mx-auto leading-relaxed">
          10 rounds of fully automated battle. Buy the token, fight for your round, win the lottery. That simple.
        </p>
        <div className="flex items-center justify-center gap-3 mt-4">
          <div className="h-px w-16" style={{ background: "rgba(230,50,50,0.3)" }} />
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#e63232" }} />
          <div className="h-px w-16" style={{ background: "rgba(230,50,50,0.3)" }} />
        </div>
      </div>

      {/* Steps grid */}
      <div className="grid gap-4 max-w-4xl mx-auto" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        {STEPS.map((step, idx) => {
          const Icon = step.icon
          return (
            <div
              key={step.number}
              className="glass-card rounded-2xl p-5 flex gap-4 transition-all duration-300"
              style={{ animationDelay: `${idx * 0.1}s` }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${step.color}55`
                e.currentTarget.style.background  = "rgba(10,10,10,0.85)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(230,50,50,0.2)"
                e.currentTarget.style.background  = "rgba(10,10,10,0.6)"
              }}
            >
              <div className="flex flex-col items-center gap-2 flex-shrink-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300"
                  style={{ background: `${step.color}18`, border: `1px solid ${step.color}44` }}
                >
                  <Icon className="w-5 h-5" style={{ color: step.color }} />
                </div>
                <span className="text-xs font-mono font-bold" style={{ color: `${step.color}80` }}>
                  {step.number}
                </span>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-sm mb-1.5 tracking-wide" style={{ color: step.color }}>
                  {step.title}
                </h3>
                <p className="text-xs text-sand-dim leading-relaxed font-mono">
                  {step.description}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* HP Strength section */}
      <div
        className="glass-card rounded-2xl p-6 max-w-2xl mx-auto mt-6"
        style={{ border: "1px solid rgba(230,50,50,0.35)" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4" style={{ color: "#e63232" }} />
          <span className="text-sm font-bold font-mono tracking-wider uppercase" style={{ color: "#e63232" }}>
            The More You Purchase &amp; Hold, The Stronger You Fight
          </span>
        </div>
        <p className="text-xs text-sand-dim font-mono leading-relaxed mb-4">
          Your fighter{"'"}s HP and battle strength are directly tied to how many CLAW tokens you hold.
          Larger holders deal more damage per hit and survive longer in the arena.
          This is not shown publicly — it is your hidden edge.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { tier: "1M tokens",  hp: "50 HP",  color: "#888888", label: "Recruit",  glow: false },
            { tier: "5M tokens",  hp: "100 HP", color: "#4a9eff", label: "Warrior",  glow: false },
            { tier: "10M tokens", hp: "150 HP", color: "#e63232", label: "Champion", glow: false },
            { tier: "20M+ tokens",hp: "200 HP", color: "#ffffff", label: "Legend",   glow: true  },
          ].map((item) => (
            <div
              key={item.tier}
              className="flex flex-col items-center gap-1.5 rounded-xl p-3 text-center"
              style={{
                background: `${item.color}10`,
                border:     `1px solid ${item.color}33`,
                boxShadow:  item.glow ? `0 0 14px ${item.color}25` : "none",
              }}
            >
              <span className="text-xs font-mono font-bold" style={{ color: item.color }}>{item.label}</span>
              <span className="text-base font-bold font-mono" style={{ color: item.color, textShadow: `0 0 8px ${item.color}60` }}>{item.hp}</span>
              <span className="text-xs font-mono" style={{ color: `${item.color}80` }}>{item.tier}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Rewards highlight */}
      <div
        className="glass-card rounded-2xl p-5 max-w-2xl mx-auto mt-8 text-center"
        style={{ border: "1px solid rgba(230,50,50,0.4)" }}
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <Gift className="w-4 h-4" style={{ color: "#e63232" }} />
          <span className="text-sm font-bold font-mono tracking-wider" style={{ color: "#e63232" }}>
            Reward Distribution
          </span>
        </div>
        <p className="text-xs text-sand-dim font-mono leading-relaxed mb-3">
          50% of all pump.fun creator rewards are split equally among the 3 grand lottery winners each session.
          Payments are sent manually and announced publicly on <a href="https://x.com/ClawBattleAI" target="_blank" rel="noopener noreferrer" style={{color:"#e63232"}}>@ClawBattleAI</a> and <a href="https://t.me/ClawBattleAI" target="_blank" rel="noopener noreferrer" style={{color:"#29b6f6"}}>Telegram</a>.
        </p>
        <div className="flex items-center justify-center gap-6 flex-wrap">
          {[
            { label: "1st Place", pct: "~33%", color: "#ffffff" },
            { label: "2nd Place", pct: "~33%", color: "#c0c0c0" },
            { label: "3rd Place", pct: "~33%", color: "#cd7f32" },
          ].map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-1">
              <span className="text-lg font-bold font-mono" style={{ color: item.color }}>{item.pct}</span>
              <span className="text-xs text-sand-dim font-mono">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
