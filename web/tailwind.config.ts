import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-nunito)", "system-ui", "sans-serif"],
        serif: ["var(--font-nunito)", "system-ui", "sans-serif"],
        display: ["var(--font-nunito)", "system-ui", "sans-serif"],
        mono: ['"Courier New"', "Courier", "ui-monospace", "monospace"],
      },
      colors: {
        // Near-white parchment surface. The page background is pure white;
        // panels, hover states, and borders carry the residual parchment
        // identity. `seal` stays the wax-seal accent for CTAs and callouts.
        parchment: {
          DEFAULT: "#ffffff",
          dark: "#ffffff",
          shade: "#f5f5f5",
          deep: "#cbb68d",
        },
        ink: {
          DEFAULT: "#1a1a1a",
          soft: "#4b4b4b",
          faded: "#8c8c8c",
          quill: "#111111",
        },
        seal: {
          DEFAULT: "#8b3a3a",
          dark: "#6e2c2c",
          bright: "#a94a4a",
        },
      },
      boxShadow: {
        vellum: "0 1px 2px rgba(75,54,33,0.08), 0 2px 6px rgba(75,54,33,0.06)",
        manuscript:
          "0 2px 4px rgba(75,54,33,0.08), 0 10px 24px -6px rgba(75,54,33,0.18)",
        seal: "0 0 0 1px rgba(139,58,58,0.25), 0 6px 16px -4px rgba(139,58,58,0.35)",
      },
      backgroundImage: {
        "sepia-gradient":
          "linear-gradient(180deg, rgba(75,54,33,0.06) 0%, rgba(75,54,33,0.02) 100%)",
      },
    },
  },
  plugins: [],
} satisfies Config;
