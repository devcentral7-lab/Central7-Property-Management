import type { Metadata, Viewport } from "next";
import { Arimo } from "next/font/google";
import "./globals.css";

// Arial-metric fallback for devices without Arial (Android); not preloaded so
// Windows/macOS/iOS never download it.
const arimo = Arimo({
  variable: "--font-arimo",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Central7 Pulse",
  description: "Central 7 opportunity register — property CRM",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1f1f1f",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${arimo.variable} h-full`}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
