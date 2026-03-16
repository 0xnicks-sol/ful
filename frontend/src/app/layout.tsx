import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = JetBrains_Mono({ subsets: ["latin"], variable: '--font-sans' });
const mono  = JetBrains_Mono({ subsets: ["latin"], variable: '--font-mono' });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://clawbattle.live";

export const metadata: Metadata = {
  title:       "ClawBattle — pump.fun Battle Grounds",
  description: "Buy the CLAW token on pump.fun and watch your fighter battle in real-time. 10 rounds, 1 winner each round, 3 random grand prize winners.",
  keywords:    ["ClawBattle", "pump.fun", "solana", "battle arena", "crypto game", "CLAW token"],
  authors:     [{ name: "ClawBattle" }],
  metadataBase: new URL(siteUrl),

  openGraph: {
    title:       "ClawBattle — pump.fun Battle Grounds",
    description: "Buy CLAW, enter the arena, fight for glory. 10 rounds · 3 grand winners · Live on Solana.",
    url:         siteUrl,
    siteName:    "ClawBattle",
    images: [
      {
        url:    `${siteUrl}/logoooooo-modified.png`,
        width:  800,
        height: 800,
        alt:    "ClawBattle Logo",
      },
    ],
    locale: "en_US",
    type:   "website",
  },

  twitter: {
    card:        "summary_large_image",
    title:       "ClawBattle — pump.fun Battle Grounds",
    description: "Buy CLAW, enter the arena, fight for glory. Live on Solana.",
    site:        "@ClawBattleAI",
    creator:     "@ClawBattleAI",
    images:      [`${siteUrl}/logoooooo-modified.png`],
  },

  // Next.js App Router picks up icon.png and apple-icon.png from src/app/ automatically.
  // These entries are explicit fallbacks for older clients.
  icons: {
    icon:      [
      { url: "/icon.png",               type: "image/png" },
      { url: "/logoooooo-modified.png", type: "image/png" },
    ],
    shortcut:  "/icon.png",
    apple:     "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${mono.variable} font-sans bg-black text-white antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
