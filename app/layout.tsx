import type { Metadata, Viewport } from "next";
import { Onest, Unbounded } from "next/font/google";
import "./globals.css";

const unbounded = Unbounded({ variable: "--font-unbounded", subsets: ["latin"], weight: ["800"], display: "swap" });
const onest = Onest({ variable: "--font-onest", subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });

export const metadata: Metadata = {
  title: "Kit · One photo of your stuff, a 3D Reel",
  description: "Photograph your things. Kit cuts out every item, rebuilds each one in 3D and turns it into an animated vertical Reel.",
};

export const viewport: Viewport = {
  themeColor: "#dc1928",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${unbounded.variable} ${onest.variable}`}>
      <body>{children}</body>
    </html>
  );
}
