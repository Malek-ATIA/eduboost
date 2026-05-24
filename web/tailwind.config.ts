import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist)", "system-ui", "sans-serif"],
        serif: ["var(--font-newsreader)", "Georgia", "serif"],
        display: ["var(--font-newsreader)", "Georgia", "serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        bg: {
          DEFAULT: "#ffffff",
          soft: "#f4f4f3",
          card: "#ffffff",
        },
        ink: {
          DEFAULT: "#111315",
          soft: "#4a5057",
          faded: "#8a8f96",
          mute: "#c5c7cb",
        },
        rule: {
          DEFAULT: "#e6e6e4",
          soft: "#efefee",
        },
        accent: {
          DEFAULT: "#1f4a3a",
          deep: "#163428",
          soft: "#d8e3dc",
          pale: "#ecf2ee",
        },
        warn: "#b3551d",
        gold: "#b9853a",
        legal: "#c2c4c8",
        parchment: {
          DEFAULT: "#ffffff",
          dark: "#f4f4f3",
          shade: "#f4f4f3",
          deep: "#d8e3dc",
        },
        seal: {
          DEFAULT: "#1f4a3a",
          dark: "#163428",
          bright: "#2a6950",
        },
      },
      boxShadow: {
        vellum: "0 1px 2px rgba(20,18,8,0.06), 0 2px 6px rgba(20,18,8,0.04)",
        manuscript:
          "0 8px 30px -16px rgba(20,18,8,0.18)",
        seal: "0 0 0 1px rgba(31,74,58,0.25), 0 6px 16px -4px rgba(31,74,58,0.25)",
      },
      borderRadius: {
        pill: "999px",
      },
      maxWidth: {
        container: "1320px",
        "container-wide": "1480px",
      },
    },
  },
  plugins: [],
} satisfies Config;
