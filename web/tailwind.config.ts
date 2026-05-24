import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-dm-sans)", "DM Sans", "system-ui", "sans-serif"],
        serif: ["var(--font-dm-sans)", "DM Sans", "system-ui", "sans-serif"],
        display: ["var(--font-dm-sans)", "DM Sans", "system-ui", "sans-serif"],
        mono: ["var(--font-dm-mono)", "DM Mono", "ui-monospace", "monospace"],
      },
      colors: {
        bg: {
          DEFAULT: "#ffffff",
          soft: "#f6f7f9",
          card: "#ffffff",
          sky: "#eaf1ff",
          sun: "#fff4d6",
          mint: "#e0f5ec",
          rose: "#ffe9e4",
        },
        ink: {
          DEFAULT: "#0e1116",
          soft: "#4a5260",
          faded: "#8a93a3",
          mute: "#c4c9d3",
        },
        rule: {
          DEFAULT: "#e7e9ee",
          soft: "#f0f2f5",
        },
        accent: {
          DEFAULT: "#2c5bff",
          deep: "#1f47d6",
          soft: "#cfdcff",
          pale: "#eaf0ff",
        },
        warn: "#ff5a3a",
        gold: "#ffb547",
        green: "#1faa6b",
        legal: "#c2c6d0",
        parchment: {
          DEFAULT: "#ffffff",
          dark: "#f6f7f9",
          shade: "#f6f7f9",
          deep: "#cfdcff",
        },
        seal: {
          DEFAULT: "#2c5bff",
          dark: "#1f47d6",
          bright: "#5078ff",
        },
      },
      boxShadow: {
        vellum: "0 1px 2px rgba(20,18,8,0.06), 0 2px 6px rgba(20,18,8,0.04)",
        manuscript: "0 18px 44px -22px rgba(20,18,8,0.22)",
        lift: "0 18px 44px -22px rgba(20,18,8,0.22)",
        seal: "0 1px 0 rgba(0,0,0,0.04), 0 8px 18px -8px rgba(44,91,255,0.5)",
      },
      borderRadius: {
        pill: "999px",
      },
      maxWidth: {
        container: "1320px",
        "container-wide": "1440px",
      },
    },
  },
  plugins: [],
} satisfies Config;
