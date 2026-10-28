import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Instrument_Serif } from "next/font/google";
import "./globals.css";
import "./motion.css";

const instrument = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: "400", style: ["normal", "italic"], display: "swap" });
const hanken = Hanken_Grotesk({ variable: "--font-hanken", subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });

export const metadata: Metadata = {
  title: "Kit · Everything you carry, now in 3D",
  description: "Photograph your bag, desk or outfit. Kit cuts out every item, rebuilds each one as a real 3D model and turns it into a Reel.",
};

export const viewport: Viewport = {
  themeColor: "#f4f2ee",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${instrument.variable} ${hanken.variable}`}>
      <body>{children}</body>
    </html>
  );
}
