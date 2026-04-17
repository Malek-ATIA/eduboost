import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Playfair Display for headings + body reads; IM Fell English for
        // display moments (hero titles, folios); Courier for codes, IDs,
        // anything that should read as monospace.
        sans: ["var(--font-playfair)", "Georgia", "ui-serif", "serif"],
        serif: ["var(--font-playfair)", "Georgia", "ui-serif", "serif"],
        display: ["var(--font-im-fell)", "var(--font-playfair)", "ui-serif", "serif"],
        mono: ['"Courier New"', "Courier", "ui-monospace", "monospace"],
      },
      colors: {
        // Parchment surface + faded-ink text. `parchment` is the default page
        // colour; deeper panels use `parchment-dark`. Text runs on the `ink`
        // scale — deep brown for headings, muted soft-ink for body, faded tan
        // for borders. `seal` is the wax-seal accent, used only for CTAs and
        // the strongest callouts so it keeps its weight.
        parchment: {
          DEFAULT: "#f1e9d2",
          dark: "#e8d9c1",
          shade: "#dcc9a8",
          deep: "#cbb68d",
        },
        ink: {
          DEFAULT: "#4b3621",
          soft: "#6b5b47",
          faded: "#8b7355",
          quill: "#333333",
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
