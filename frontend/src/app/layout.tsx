import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = JetBrains_Mono({ subsets: ["latin"], variable: '--font-sans' });
const mono  = JetBrains_Mono({ subsets: ["latin"], variable: '--font-mono' });

export const metadata: Metadata = {
  title: "ClawBattle — pump.fun Battle Grounds",
  description:
    "Buy the CLAW token on pump.fun and watch your fighter battle in real-time. 10 rounds, 1 winner each round, 3 random grand prize winners.",
  keywords: ["ClawBattle", "pump.fun", "solana", "battle arena", "crypto game", "CLAW token"],
  authors: [{ name: "ClawBattle" }],
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://clawbattle.fun"
  ),
  openGraph: {
    title:       "ClawBattle — pump.fun Battle Grounds",
    description: "Buy CLAW, enter the arena, fight for glory. 10 rounds · 3 grand winners · Live on Solana.",
    url:         process.env.NEXT_PUBLIC_SITE_URL || "https://clawbattle.fun",
    siteName:    "ClawBattle",
    images: [
      {
        url:    "/logoooooo-modified.png",
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
    images:      ["/logoooooo-modified.png"],
  },
  icons: {
    icon:      "/logoooooo-modified.png",
    shortcut:  "/logoooooo-modified.png",
    apple:     "/logoooooo-modified.png",
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
