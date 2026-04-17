import type { Metadata } from "next";
import { Playfair_Display, IM_Fell_English } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-playfair",
  display: "swap",
});

const imFell = IM_Fell_English({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-im-fell",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EduBoost — Trusted tutoring, online",
  description:
    "Find verified teachers, book sessions, take AI-graded exams, and learn in a built-in video classroom.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${imFell.variable}`}>
      <body className="min-h-screen font-serif text-ink">{children}</body>
    </html>
  );
}
