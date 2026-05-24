import type { Metadata } from "next";
import { Newsreader, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { AppShell } from "@/components/AppShell";
import { Footer } from "@/components/Footer";
import { ToastProvider } from "@/components/Toast";
import { DialogProvider } from "@/components/Dialog";

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EduBoost — Trusted tutoring in Tunisia",
  description:
    "Find verified Tunisian tutors, book sessions, take AI-graded exams, and learn in a built-in video classroom.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${newsreader.variable} ${geist.variable} ${geistMono.variable}`}>
      <body className="flex min-h-screen flex-col font-sans text-ink">
        <ToastProvider>
          <DialogProvider>
            <Header />
            <Breadcrumbs />
            <div className="flex-1">
              <AppShell>{children}</AppShell>
            </div>
            <Footer />
          </DialogProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
