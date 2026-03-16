"use client"

export type GladiatorState = "idle" | "attack" | "hit" | "dead" | "entering" | "victory"

export interface GladiatorProps {
  walletAddress: string
  state?: GladiatorState
  size?: number
  showName?: boolean
  isWinner?: boolean
  /** True = faces right (toward target). SVG is drawn facing right by default. */
  flipped?: boolean
  /** Incremented each attack tick so CSS animations replay */
  animKey?: number
}

function getGladiatorColors(wallet: string) {
  const hash = wallet.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const palettes = [
    { primary: "#c9a227", secondary: "#8b4513", helmet: "#d4af37", plume: "#cc1111", shield: "#b8860b" },
    { primary: "#4a9eff", secondary: "#1a3a6e", helmet: "#6ab0ff", plume: "#ffffff", shield: "#2a5a9e" },
    { primary: "#7fff7f", secondary: "#1a5a1a", helmet: "#90ee90", plume: "#00aa00", shield: "#2d8a2d" },
    { primary: "#ff7f7f", secondary: "#6e1a1a", helmet: "#ff9999", plume: "#ffcc00", shield: "#8b2020" },
    { primary: "#bf7fff", secondary: "#4a1a6e", helmet: "#d0a0ff", plume: "#ff69b4", shield: "#6a2a9e" },
    { primary: "#ff9f3f", secondary: "#5a2a00", helmet: "#ffb060", plume: "#ffffff", shield: "#8b4500" },
    { primary: "#3fffff", secondary: "#005a5a", helmet: "#60ffff", plume: "#0099ff", shield: "#008080" },
    { primary: "#ff3fff", secondary: "#5a005a", helmet: "#ff80ff", plume: "#ffff00", shield: "#880088" },
  ]
  return palettes[hash % palettes.length]
}

function shortenAddress(addr: string) {
  if (addr.length < 8) return addr
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`
}

export function GladiatorCharacter({
  walletAddress,
  state = "idle",
  size = 80,
  showName = true,
  isWinner = false,
  flipped = false,
  animKey = 0,
}: GladiatorProps) {
  const colors = getGladiatorColors(walletAddress)
  const uid = walletAddress.slice(0, 6)

  const swordArmStyle: React.CSSProperties = {
    transformBox: "fill-box",
    transformOrigin: "72px 58px",
    animation: state === "attack"
      ? `sword-swing 0.52s cubic-bezier(0.4,0,0.2,1) both`
      : "none",
  }

  const shieldArmStyle: React.CSSProperties = {
    transformBox: "fill-box",
    transformOrigin: "28px 58px",
    animation: state === "hit"
      ? `shield-block 0.45s ease-out both`
      : "none",
  }

  const bodyStyle: React.CSSProperties = {
    transformBox: "fill-box",
    transformOrigin: "50px 80px",
    animation: state === "attack"
      ? `body-lunge 0.52s cubic-bezier(0.4,0,0.2,1) both`
      : state === "hit"
      ? `body-flinch 0.45s ease-out both`
      : state === "idle"
      ? `fighter-idle 2.4s ease-in-out infinite`
      : state === "victory"
      ? `float 1.6s ease-in-out infinite`
      : state === "entering"
      ? `enter-arena 0.6s cubic-bezier(0.175,0.885,0.32,1.275) both`
      : state === "dead"
      ? `fighter-die 0.9s ease-in-out forwards`
      : "none",
  }

  const wrapperStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    userSelect: "none",
    transform: flipped ? "scaleX(-1)" : "scaleX(1)",
    filter: state === "dead" ? "grayscale(1) brightness(0.35)" : "none",
    transition: "filter 0.3s ease",
  }

  return (
    <div style={wrapperStyle} key={`${walletAddress}-${animKey}`}>
      <svg
        width={size}
        height={size * 1.4}
        viewBox="0 0 100 140"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label={`Gladiator ${shortenAddress(walletAddress)}`}
        style={{ overflow: "visible" }}
      >
        <defs>
          <filter id={`shadow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor={colors.primary} floodOpacity="0.45" />
          </filter>
          <radialGradient id={`ag-${uid}`} cx="50%" cy="30%" r="60%">
            <stop offset="0%" stopColor={colors.primary} />
            <stop offset="100%" stopColor={colors.secondary} />
          </radialGradient>
          <radialGradient id={`sg-${uid}`} cx="40%" cy="35%" r="55%">
            <stop offset="0%" stopColor={colors.shield} />
            <stop offset="60%" stopColor={colors.secondary} />
            <stop offset="100%" stopColor="#1a1005" />
          </radialGradient>
        </defs>

        {/* Ground shadow */}
        <ellipse cx="50" cy="136" rx="28" ry="5" fill="#000000" opacity="0.45" />

        <g style={bodyStyle}>
          {/* Legs */}
          <rect x="34" y="102" width="10" height="20" rx="3" fill={colors.secondary} />
          <rect x="35" y="103" width="8" height="18" rx="2" fill={`url(#ag-${uid})`} opacity="0.7" />
          <rect x="56" y="102" width="10" height="20" rx="3" fill={colors.secondary} />
          <rect x="57" y="103" width="8" height="18" rx="2" fill={`url(#ag-${uid})`} opacity="0.7" />
          {/* Sandals */}
          <ellipse cx="39" cy="124" rx="8" ry="4" fill="#3d2b1a" />
          <ellipse cx="61" cy="124" rx="8" ry="4" fill="#3d2b1a" />
          <line x1="33" y1="120" x2="45" y2="120" stroke="#5a3d22" strokeWidth="1.5" />
          <line x1="55" y1="120" x2="67" y2="120" stroke="#5a3d22" strokeWidth="1.5" />

          {/* Pteruges */}
          {[28, 34, 40, 46, 52, 58, 64, 70].map((x, i) => (
            <rect
              key={i}
              x={x}
              y="82"
              width="7"
              height="24"
              rx="2"
              fill={i % 2 === 0 ? colors.secondary : "#2a1a08"}
              transform={`rotate(${(i - 3.5) * 1.5} ${x + 3} 82)`}
              opacity="0.9"
            />
          ))}

          {/* Torso / chest armor */}
          <path d="M30 55 Q28 75 30 90 L70 90 Q72 75 70 55 Q60 48 50 47 Q40 48 30 55Z" fill={`url(#ag-${uid})`} />
          <path d="M38 60 Q50 56 62 60 Q60 70 50 72 Q40 70 38 60Z" fill={colors.primary} opacity="0.3" />
          <path d="M36 62 Q50 58 64 62" stroke={colors.primary} strokeWidth="1" opacity="0.4" fill="none" />
          <path d="M35 68 Q50 64 65 68" stroke={colors.primary} strokeWidth="1" opacity="0.3" fill="none" />
          {/* Belt */}
          <rect x="29" y="84" width="42" height="8" rx="2" fill="#2a1a08" />
          <rect x="30" y="85" width="40" height="6" rx="1" fill={colors.secondary} opacity="0.8" />
          <rect x="46" y="85" width="8" height="6" rx="1" fill={colors.primary} />
          <circle cx="50" cy="88" r="2" fill={colors.secondary} />

          {/* Shield arm */}
          <g style={shieldArmStyle}>
            <path d="M28 58 Q18 65 16 78" stroke={colors.secondary} strokeWidth="8" strokeLinecap="round" fill="none" />
            <path d="M28 58 Q18 65 16 78" stroke={colors.primary} strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.55" />
            <path d="M16 78 Q14 88 16 96" stroke={colors.secondary} strokeWidth="7" strokeLinecap="round" fill="none" />
            <ellipse cx="10" cy="92" rx="18" ry="21" fill={`url(#sg-${uid})`} filter={`url(#shadow-${uid})`} />
            <ellipse cx="10" cy="92" rx="18" ry="21" fill="none" stroke={colors.primary} strokeWidth="2" />
            <ellipse cx="10" cy="92" rx="13" ry="16" fill="none" stroke={colors.primary} strokeWidth="1" opacity="0.5" />
            <ellipse cx="10" cy="92" rx="8" ry="10" fill="none" stroke={colors.primary} strokeWidth="1" opacity="0.4" />
            <circle cx="10" cy="92" r="4" fill={colors.primary} />
            <circle cx="10" cy="92" r="2" fill={colors.secondary} />
            <line x1="10" y1="72" x2="10" y2="112" stroke={colors.primary} strokeWidth="0.8" opacity="0.3" />
            <line x1="-7" y1="92" x2="27" y2="92" stroke={colors.primary} strokeWidth="0.8" opacity="0.3" />
          </g>

          {/* Sword arm */}
          <g style={swordArmStyle}>
            <path d="M72 58 Q82 65 84 74" stroke={colors.secondary} strokeWidth="8" strokeLinecap="round" fill="none" />
            <path d="M72 58 Q82 65 84 74" stroke={colors.primary} strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.55" />
            <path d="M84 74 Q88 84 86 95" stroke={colors.secondary} strokeWidth="7" strokeLinecap="round" fill="none" />
            <rect x="82" y="93" width="7" height="14" rx="2" fill="#4a2e0e" />
            <rect x="83" y="94" width="5" height="12" rx="1" fill="#6b4019" />
            <rect x="78" y="91" width="14" height="4" rx="2" fill={colors.primary} />
            <path d="M84 91 L82 60 L86 60 Z" fill="#c8c8c8" />
            <path d="M84 91 L83 60 L84 55 L85 60 Z" fill="#e8e8e8" />
            <line x1="83.2" y1="60" x2="84" y2="91" stroke="#ffffff" strokeWidth="0.6" opacity="0.55" />
          </g>

          {/* Neck */}
          <rect x="44" y="44" width="12" height="12" rx="3" fill="#8b6914" />

          {/* Head / face */}
          <ellipse cx="50" cy="36" rx="13" ry="14" fill="#8b6914" />
          <path d="M42 44 Q50 50 58 44" fill="#7a5c10" opacity="0.6" />

          {/* Corinthian helmet */}
          <path d="M36 33 Q36 14 50 12 Q64 14 64 33 Q64 40 58 43 Q54 45 50 45 Q46 45 42 43 Q36 40 36 33Z" fill={`url(#ag-${uid})`} filter={`url(#shadow-${uid})`} />
          <path d="M36 33 Q33 36 34 42 Q38 45 42 43 Q36 40 36 33Z" fill={colors.secondary} opacity="0.8" />
          <path d="M64 33 Q67 36 66 42 Q62 45 58 43 Q64 40 64 33Z" fill={colors.secondary} opacity="0.8" />
          <rect x="47" y="34" width="6" height="10" rx="2" fill={colors.secondary} opacity="0.9" />
          <path d="M37 30 Q42 27 48 30" fill="none" stroke="#1a0f00" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M52 30 Q58 27 63 30" fill="none" stroke="#1a0f00" strokeWidth="2.5" strokeLinecap="round" />
          <rect x="46" y="11" width="8" height="4" rx="1" fill={colors.secondary} />
          <path d="M50 11 Q44 4 42 -2 Q46 0 48 3 Q50 0 50 -4 Q52 0 52 3 Q54 0 58 -2 Q56 4 50 11Z" fill={colors.plume} opacity="0.9" />
          <path d="M50 9 Q45 3 44 -1 Q48 1 49 4 Q50 1 50 -3 Q51 2 52 4 Q54 1 56 -1 Q55 3 50 9Z" fill={colors.plume} opacity="0.55" />
          <path d="M40 18 Q44 13 50 12" stroke="rgba(255,255,255,0.38)" strokeWidth="2" strokeLinecap="round" fill="none" />

          {/* Winner stars */}
          {isWinner && (
            <>
              <circle cx="50" cy="4" r="3" fill="#ffd700" opacity="0.9">
                <animate attributeName="opacity" values="0.5;1;0.5" dur="1s" repeatCount="indefinite" />
              </circle>
              <circle cx="44" cy="6" r="2" fill="#ffd700" opacity="0.7">
                <animate attributeName="opacity" values="0.3;0.8;0.3" dur="1.2s" repeatCount="indefinite" />
              </circle>
              <circle cx="56" cy="6" r="2" fill="#ffd700" opacity="0.7">
                <animate attributeName="opacity" values="0.3;0.8;0.3" dur="0.9s" repeatCount="indefinite" />
              </circle>
            </>
          )}
        </g>
      </svg>

      {showName && (
        <div
          className="text-center px-2 py-0.5 rounded font-mono"
          style={{
            background: "rgba(0,0,0,0.65)",
            border: `1px solid ${colors.primary}44`,
            color: colors.primary,
            fontSize: 10,
            maxWidth: size + 20,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            transform: flipped ? "scaleX(-1)" : "scaleX(1)",
          }}
        >
          {shortenAddress(walletAddress)}
        </div>
      )}
    </div>
  )
}
