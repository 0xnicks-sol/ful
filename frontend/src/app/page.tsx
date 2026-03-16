"use client"

import { useEffect, useState } from "react"
import { TokenInfoBar, LiveTicker, LiveFeedPanel } from "@/components/live-feed"
import { BattleArena } from "@/components/battle-arena"
import { LobbyCountdown, FighterRoster, BattleStats } from "@/components/lobby-countdown"
import { Leaderboard, LotteryWheel } from "@/components/leaderboard"
import { HowItWorks } from "@/components/how-it-works"
import { useBattleSimulation } from "@/hooks/use-battle-simulation"
import { Sword, Trophy, LayoutGrid, Shield, Zap, Crown } from "lucide-react"

const TOKEN_MINT   = process.env.NEXT_PUBLIC_TOKEN_MINT   || "BwCq8ehGpSgoeipHYd9DYtciNYPsA6k8bBEXNAQSpump"
const TOKEN_NAME   = process.env.NEXT_PUBLIC_TOKEN_NAME   || "CLAW"
const TOKEN_SYMBOL = process.env.NEXT_PUBLIC_TOKEN_SYMBOL || "CLAW"
const TOTAL_ROUNDS = 10

function NavTab({
  active,
  onClick,
  children,
  icon,
  badge,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  icon?: React.ReactNode
  badge?: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-mono tracking-widest uppercase transition-all duration-200"
      style={{
        color:        active ? "#e63232" : "#888888",
        borderBottom: active ? "2px solid #e63232" : "2px solid transparent",
        background:   "none",
        cursor:       "pointer",
      }}
    >
      {icon}
      {children}
      {badge}
    </button>
  )
}

function HpStrengthNotice() {
  return (
    <div
      className="flex items-start gap-3 rounded-xl px-4 py-3"
      style={{ background: "rgba(230,50,50,0.06)", border: "1px solid rgba(230,50,50,0.28)" }}
    >
      <Zap className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#e63232" }} />
      <div>
        <p className="text-xs font-mono font-bold tracking-wide uppercase mb-0.5" style={{ color: "#e63232" }}>
          Hold More · Fight Stronger
        </p>
        <p className="text-xs font-mono leading-relaxed" style={{ color: "#888888" }}>
          The more tokens you purchase and hold, the greater your fighter{"'"}s HP and battle strength. Larger holders deal more damage and survive longer.
        </p>
      </div>
    </div>
  )
}

function AmbientBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
      <div className="absolute" style={{ width: 500, height: 500, top: -150, left: -150, background: "radial-gradient(circle, rgba(230,50,50,0.05) 0%, transparent 70%)", borderRadius: "50%" }} />
      <div className="absolute" style={{ width: 400, height: 400, top: -80, right: -80, background: "radial-gradient(circle, rgba(139,0,0,0.04) 0%, transparent 70%)", borderRadius: "50%" }} />
      <div className="absolute" style={{ width: 700, height: 350, bottom: 0, left: "50%", transform: "translateX(-50%)", background: "radial-gradient(ellipse, rgba(230,50,50,0.035) 0%, transparent 70%)" }} />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "linear-gradient(rgba(230,50,50,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(230,50,50,0.4) 1px, transparent 1px)",
          backgroundSize:  "60px 60px",
        }}
      />
    </div>
  )
}

/** Tournament-complete full-screen banner */
function TournamentCompleteBanner({
  onGoToLeaderboard,
}: {
  onGoToLeaderboard: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 p-6"
      style={{ background: "rgba(10,10,10,0.93)", backdropFilter: "blur(8px)" }}
    >
      <Crown className="w-16 h-16" style={{ color: "#ffffff", filter: "drop-shadow(0 0 30px rgba(255,255,255,0.7))" }} />
      <div className="text-center flex flex-col gap-2">
        <h2
          className="text-4xl font-bold tracking-widest uppercase"
          style={{ fontFamily: "Georgia, serif", color: "#ffffff", textShadow: "0 0 40px rgba(255,255,255,0.5)" }}
        >
          Tournament Complete!
        </h2>
        <p className="text-sm font-mono text-sand-dim">
          All 10 rounds finished — 3 grand winners are being selected now
        </p>
      </div>
      <button
        onClick={onGoToLeaderboard}
        className="px-8 py-3 rounded-xl text-sm font-bold font-mono tracking-wider uppercase transition-all duration-200"
        style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.6)", color: "#ffffff", boxShadow: "0 0 24px rgba(255,255,255,0.3)" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.25)" }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.15)" }}
      >
        See Grand Winners →
      </button>
    </div>
  )
}

export default function Home() {
  const [activeTab,        setActiveTab]        = useState<"arena" | "leaderboard" | "howto">("arena")
  const [showLottery,      setShowLottery]      = useState(false)
  const [showTournamentBanner, setShowTournamentBanner] = useState(false)

  const {
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
    tournamentComplete,
    autoStartLottery,
    queueCount,
    handleLotteryComplete,
    handleWinnerClose,
    isLotteryEligible,
  } = useBattleSimulation()

  // When tournament completes, show the banner and then auto-switch to leaderboard
  useEffect(() => {
    if (tournamentComplete) {
      setShowTournamentBanner(true)
    }
  }, [tournamentComplete])

  const handleGoToLeaderboard = () => {
    setShowTournamentBanner(false)
    setActiveTab("leaderboard")
    setShowLottery(true)
  }

  // Auto-switch to leaderboard tab when lottery auto-starts (from socket event)
  useEffect(() => {
    if (autoStartLottery) {
      setActiveTab("leaderboard")
      setShowLottery(true)
    }
  }, [autoStartLottery])

  return (
    <div className="relative min-h-screen flex flex-col" style={{ background: "#0a0a0a" }}>
      <AmbientBackground />

      {/* Tournament complete banner (full-screen overlay) */}
      {showTournamentBanner && (
        <TournamentCompleteBanner onGoToLeaderboard={handleGoToLeaderboard} />
      )}

      {/* Sticky header */}
      <header className="relative z-50 sticky top-0">
        <TokenInfoBar
          tokenName={TOKEN_NAME}
          tokenSymbol={TOKEN_SYMBOL}
          contractAddress={TOKEN_MINT}
          pumpFunUrl={`https://pump.fun/coin/${TOKEN_MINT}`}
          twitterUrl="https://x.com/ClawBattleAI"
          totalWinners={leaderboard.length}
        />
        <div
          className="flex items-center px-4"
          style={{ background: "rgba(10,10,10,0.97)", borderBottom: "1px solid rgba(230,50,50,0.15)" }}
        >
          <NavTab active={activeTab === "arena"} onClick={() => setActiveTab("arena")} icon={<Sword className="w-3 h-3" />}>
            Arena
          </NavTab>
          <NavTab
            active={activeTab === "leaderboard"}
            onClick={() => setActiveTab("leaderboard")}
            icon={<Trophy className="w-3 h-3" />}
            badge={
              totalRoundsCompleted > 0
                ? <span className="ml-1 px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: "rgba(230,50,50,0.2)", color: "#e63232", fontSize: 9 }}>
                    {totalRoundsCompleted}/{TOTAL_ROUNDS}
                  </span>
                : null
            }
          >
            Leaderboard
          </NavTab>
          <NavTab active={activeTab === "howto"} onClick={() => setActiveTab("howto")} icon={<LayoutGrid className="w-3 h-3" />}>
            How It Works
          </NavTab>
        </div>
      </header>

      {/* Scrolling event ticker */}
      <LiveTicker events={feedEvents} />

      <main className="relative z-10 flex-1">

        {/* ===== ARENA TAB ===== */}
        {activeTab === "arena" && (
          <div className="flex flex-col xl:flex-row gap-4 p-4">

            {/* Left sidebar */}
            <aside className="flex flex-col gap-3 xl:w-60 flex-shrink-0">
              {battlePhase === "lobby" && (
                <LobbyCountdown
                  timeRemaining={countdown}
                  totalTime={60}
                  fighters={fighters}
                  maxFighters={30}
                />
              )}
              <BattleStats fighters={fighters} round={round} />

              <HpStrengthNotice />

              {/* Mini leaderboard */}
              <div className="glass-card rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-3.5 h-3.5" style={{ color: "#e63232" }} />
                    <span className="text-xs tracking-widest uppercase font-mono text-sand-dim">Round Winners</span>
                  </div>
                  <button
                    className="text-xs font-mono transition-colors"
                    style={{ color: "#e63232", cursor: "pointer" }}
                    onClick={() => setActiveTab("leaderboard")}
                  >
                    {totalRoundsCompleted}/{TOTAL_ROUNDS}
                  </button>
                </div>
                {leaderboard.slice(0, 7).map((entry) => (
                  <div key={entry.walletAddress} className="flex items-center gap-2">
                    <span
                      className="text-xs font-mono font-bold w-5 text-center"
                      style={{
                        color: entry.rank === 1 ? "#ffffff" : entry.rank === 2 ? "#c0c0c0" : entry.rank === 3 ? "#cd7f32" : "#888888",
                      }}
                    >
                      {entry.rank}
                    </span>
                    <span className="text-xs font-mono text-sand flex-1 truncate">
                      {entry.walletAddress.slice(0, 6)}...{entry.walletAddress.slice(-3)}
                    </span>
                    <span className="text-xs font-mono" style={{ color: "#e63232" }}>{entry.roundsWon}W</span>
                  </div>
                ))}
                {leaderboard.length === 0 && (
                  <span className="text-xs text-sand-dim font-mono">No winners yet</span>
                )}
                {/* Mini progress bar */}
                <div className="w-full rounded-full overflow-hidden mt-1" style={{ height: 3, background: "rgba(230,50,50,0.1)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${(totalRoundsCompleted / TOTAL_ROUNDS) * 100}%`, background: "linear-gradient(90deg,#e63232,#e63232)" }}
                  />
                </div>
              </div>
            </aside>

            {/* Center: Arena */}
            <div className="flex-1 flex flex-col items-center min-w-0">
              <div className="text-center mb-3">
                <h1
                  className="text-4xl md:text-5xl font-bold tracking-widest uppercase text-balance"
                  style={{ fontFamily: "Georgia, serif", color: "#e63232", lineHeight: 1.1, textShadow: "0 0 40px rgba(230,50,50,0.35)" }}
                >
                  ClawBattle
                </h1>
                <p className="text-xs text-sand-dim font-mono tracking-widest mt-1 uppercase">
                  pump.fun Battle Grounds · Round {round} of {TOTAL_ROUNDS}
                </p>
              </div>

              <div className="w-full flex justify-center">
                <BattleArena
                  fighters={fighters}
                  battlePhase={battlePhase}
                  round={round}
                  winnerId={winnerId}
                  showWinnerPopup={showWinnerPopup}
                  winnerWallet={winnerWallet}
                  onWinnerClose={handleWinnerClose}
                />
              </div>

              <div className="w-full mt-4">
                <FighterRoster fighters={fighters} />
              </div>
            </div>

            {/* Right sidebar: Live feed */}
            <aside className="flex flex-col gap-3 xl:w-72 flex-shrink-0">
              <LiveFeedPanel events={feedEvents} queueCount={queueCount} />

              {/* Rules card */}
              <div
                className="glass-card rounded-2xl p-4 flex flex-col gap-2.5"
                style={{ border: "1px solid rgba(230,50,50,0.2)" }}
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5" style={{ color: "#e63232" }} />
                  <span className="text-xs font-mono tracking-widest uppercase text-sand-dim">ClawBattle Rules</span>
                </div>
                {[
                  { dot: "#22c55e", text: "Buy token → Enter arena automatically" },
                  { dot: "#e63232", text: "Sell token → Instant elimination" },
                  { dot: "#4a9eff", text: "Hold more → Higher HP + strength" },
                  { dot: "#ff2e2e", text: "Last fighter alive wins the round" },
                  { dot: "#e63232", text: `10 rounds played, then shuffle all winners` },
                  { dot: "#ffffff", text: "3 random winners share 50% of rewards" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: item.dot, boxShadow: `0 0 4px ${item.dot}80` }} />
                    <span className="text-xs font-mono leading-relaxed" style={{ color: "#888888" }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        )}

        {/* ===== LEADERBOARD TAB ===== */}
        {activeTab === "leaderboard" && (
          <div className="p-4 max-w-6xl mx-auto w-full">
            <div className="mb-4">
              <HpStrengthNotice />
            </div>

            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <Leaderboard
                  entries={leaderboard}
                  onRunLottery={() => setShowLottery(true)}
                  isLotteryEligible={isLotteryEligible}
                  grandWinners={grandWinners}
                  totalRoundsCompleted={totalRoundsCompleted}
                  totalRounds={TOTAL_ROUNDS}
                />
              </div>

              <div className="lg:w-96 flex-shrink-0 flex flex-col gap-4">

                {/* Auto lottery (backend triggered) */}
                {autoStartLottery && grandWinners.length === 0 && (
                  <LotteryWheel
                    entries={leaderboard}
                    onComplete={handleLotteryComplete}
                    autoStart={true}
                    preselectedWinners={grandWinners}
                  />
                )}

                {/* Manual lottery trigger */}
                {(showLottery && !autoStartLottery) && grandWinners.length === 0 && (
                  <LotteryWheel entries={leaderboard} onComplete={handleLotteryComplete} />
                )}

                {/* Grand winners display */}
                {grandWinners.length > 0 && (
                  <div className="glass-card rounded-2xl p-5 flex flex-col gap-4">
                    <div className="text-center">
                      <p className="text-xs font-mono tracking-widest uppercase text-sand-dim mb-1">Grand Winners</p>
                      <h3
                        className="text-xl font-bold"
                        style={{ fontFamily: "Georgia, serif", color: "#ffffff", textShadow: "0 0 20px rgba(255,255,255,0.5)" }}
                      >
                        50% Rewards Split
                      </h3>
                    </div>
                    <p className="text-xs text-sand-dim font-mono leading-relaxed text-center">
                      Randomly selected from all 10 round winners via ClawBattle shuffle algorithm.
                    </p>
                    <div className="flex flex-col gap-2">
                      {grandWinners.map((w, i) => (
                        <div
                          key={w}
                          className="rounded-xl p-3"
                          style={{
                            background: i === 0 ? "rgba(255,255,255,0.08)" : i === 1 ? "rgba(192,192,192,0.06)" : "rgba(205,127,50,0.06)",
                            border:     `1px solid ${i === 0 ? "rgba(255,255,255,0.4)" : i === 1 ? "rgba(192,192,192,0.3)" : "rgba(205,127,50,0.3)"}`,
                          }}
                        >
                          <p
                            className="text-xs font-mono font-bold mb-0.5"
                            style={{ color: i === 0 ? "#ffffff" : i === 1 ? "#c0c0c0" : "#cd7f32" }}
                          >
                            {i === 0 ? "🥇 1st Place" : i === 1 ? "🥈 2nd Place" : "🥉 3rd Place"}
                          </p>
                          <p className="text-xs font-mono text-sand break-all">{w}</p>
                        </div>
                      ))}
                    </div>
                    <a
                      href="https://x.com/ClawBattleAI"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-center"
                      style={{ color: "#e63232" }}
                    >
                      Follow @ClawBattleAI on X for payout confirmation →
                    </a>
                  </div>
                )}

                {/* Season stats */}
                <div
                  className="glass-card rounded-2xl p-4 flex flex-col gap-3"
                  style={{ border: "1px solid rgba(230,50,50,0.18)" }}
                >
                  <span className="text-xs font-mono tracking-widest uppercase text-sand-dim">Season Stats</span>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Rounds Played",      value: `${totalRoundsCompleted}/${TOTAL_ROUNDS}`, color: "#e63232" },
                      { label: "Round Winners",       value: leaderboard.length,                        color: "#4a9eff" },
                      { label: "Grand Winners",       value: grandWinners.length,                       color: "#ffffff" },
                      { label: "Rounds Left",         value: Math.max(0, TOTAL_ROUNDS - totalRoundsCompleted), color: "#22c55e" },
                    ].map((s) => (
                      <div key={s.label} className="flex flex-col gap-0.5 rounded-xl p-2.5" style={{ background: "rgba(0,0,0,0.3)" }}>
                        <span className="font-mono font-bold text-xl leading-none" style={{ color: s.color, textShadow: `0 0 10px ${s.color}60` }}>
                          {s.value}
                        </span>
                        <span className="text-xs text-sand-dim font-mono leading-tight">{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ===== HOW IT WORKS TAB ===== */}
        {activeTab === "howto" && (
          <div>
            <div className="max-w-4xl mx-auto px-4 pt-4">
              <HpStrengthNotice />
            </div>
            <HowItWorks />
          </div>
        )}
      </main>

      <footer
        className="relative z-10 px-5 py-3 flex items-center justify-between flex-wrap gap-2"
        style={{ borderTop: "1px solid rgba(230,50,50,0.15)", background: "rgba(10,10,10,0.95)" }}
      >
        <span className="text-xs font-mono text-sand-dim">
          CLAWBATTLE · pump.fun Battle Grounds · 10-Round Tournament · 24/7 LIVE
        </span>
        <div className="flex items-center gap-3">
          <a href={`https://pump.fun/coin/${TOKEN_MINT}`} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-sand-dim hover:text-gold transition-colors">
            pump.fun
          </a>
          <span className="text-sand-dim opacity-30">·</span>
          <a href="https://x.com/ClawBattleAI" target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-sand-dim hover:text-gold transition-colors">
            X / Twitter
          </a>
          <span className="text-sand-dim opacity-30">·</span>
          <a href="https://t.me/ClawBattleAI" target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-sand-dim hover:text-gold transition-colors">
            Telegram
          </a>
        </div>
      </footer>
    </div>
  )
}
