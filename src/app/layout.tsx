import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "C1Pay",
  description: "C1Pay — send and request money in real time.",
};

// Responsive support is a deliberate teaching artifact (FR30), not incidental.
// Next.js auto-injects `width=device-width, initial-scale=1`; making it explicit
// documents the contract. Intentionally NO `maximumScale`/`userScalable` — disabling
// pinch-zoom is a WCAG 1.4.4 (Resize Text) failure and is forbidden by Epic 6.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
