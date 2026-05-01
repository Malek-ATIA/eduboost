import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { AppShell } from "@/components/AppShell";
import { Footer } from "@/components/Footer";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EduBoost — Trusted tutoring in Tunisia",
  description:
    "Find verified Tunisian tutors, book sessions, take AI-graded exams, and learn in a built-in video classroom.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={nunito.variable}>
      <body className="flex min-h-screen flex-col font-sans text-ink">
        <Header />
        <Breadcrumbs />
        <div className="flex-1">
          <AppShell>{children}</AppShell>
        </div>
        <Footer />
      </body>
    </html>
  );
}
