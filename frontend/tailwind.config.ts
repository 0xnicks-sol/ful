import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/hooks/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Map Tailwind classes → CSS variables so `text-gold`, `bg-sand` etc. work
        background:  "var(--background)",
        foreground:  "var(--foreground)",
        border:      "var(--border)",
        ring:        "var(--ring)",
        gold:        "var(--gold)",
        "gold-bright":"var(--gold-bright)",
        "gold-dim":  "var(--gold-dim)",
        crimson:     "var(--crimson)",
        "crimson-bright": "var(--crimson-bright)",
        blood:       "var(--blood)",
        sand:        "var(--sand)",
        "sand-dim":  "var(--sand-dim)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":  "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      fontFamily: {
        serif: ["Georgia", "serif"],
        mono:  ['"Geist Mono"', "monospace"],
      },
      borderRadius: {
        sm: "calc(var(--radius) - 2px)",
        md: "var(--radius)",
        lg: "calc(var(--radius) + 4px)",
        xl: "calc(var(--radius) + 8px)",
      },
      animation: {
        "float":               "float 3s ease-in-out infinite",
        "pulse-gold":          "pulse-gold 2s ease-in-out infinite",
        "pulse-crimson":       "pulse-crimson 1.5s ease-in-out infinite",
        "ring-rotate":         "ring-rotate 20s linear infinite",
        "ring-rotate-reverse": "ring-rotate-reverse 15s linear infinite",
        "fighter-idle":        "fighter-idle 2s ease-in-out infinite",
        "fighter-attack":      "fighter-attack 0.5s ease-in-out",
        "fighter-die":         "fighter-die 0.8s ease-in-out forwards",
        "enter-arena":         "enter-arena 0.6s cubic-bezier(0.175,0.885,0.32,1.275) forwards",
        "ticker":              "ticker-scroll 30s linear infinite",
        "crowd":               "crowd-cheer 3s ease-in-out infinite",
        "countdown":           "countdown-pulse 1s ease-in-out infinite",
      },
      keyframes: {
        float:               { "0%,100%": { transform: "translateY(0px)" }, "50%": { transform: "translateY(-8px)" } },
        "ring-rotate":       { from: { transform: "rotate(0deg)" },  to: { transform: "rotate(360deg)" } },
        "ring-rotate-reverse": { from: { transform: "rotate(360deg)" }, to: { transform: "rotate(0deg)" } },
        "enter-arena":       { "0%": { transform: "scale(0) translateY(40px)", opacity: "0" }, "70%": { transform: "scale(1.1) translateY(-5px)", opacity: "0.9" }, "100%": { transform: "scale(1) translateY(0)", opacity: "1" } },
        "countdown-pulse":   { "0%,100%": { transform: "scale(1)" }, "50%": { transform: "scale(1.08)" } },
        "crowd-cheer":       { "0%,100%": { opacity: "0.15" }, "50%": { opacity: "0.35" } },
      },
    },
  },
  plugins: [],
};

export default config;
