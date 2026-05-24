import type { Metadata } from "next";
import { DM_Sans, DM_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { AppShell } from "@/components/AppShell";
import { Footer } from "@/components/Footer";
import { ToastProvider } from "@/components/Toast";
import { DialogProvider } from "@/components/Dialog";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EduBoost — Trusted tutoring in Tunisia",
  description:
    "Find verified Tunisian tutors, book sessions, take AI-graded exams, and learn in a built-in video classroom.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable}`}>
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
