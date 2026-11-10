import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Platforma (llogaria, paneli, admin): paleta OnlineMenu.al me emra semantikë ──
        canvas: "#FFF8EE", // Warm White
        surface: "#FFFFFF", // kartat
        ink: "#3A1035", // Aubergine deep
        muted: "#6E4D68", // tekst dytësor (≥4.5:1 mbi canvas)
        line: "#EEDFD3", // kontura delikate
        primary: {
          DEFAULT: "#4C1845", // Aubergine (butona, theks veprimi; tekst i bardhë)
          dark: "#3A1035",
          soft: "#FFF1B8", // Butter soft (nav aktiv, badge)
        },
        accent: "#FF79BD", // Pink — vetëm dekor, kurrë tekst i vogël

        // ── OnlineMenu.al — paleta e vetme e miratuar e faqeve publike (shih src/lib/om-theme.ts) ──
        // Butter/Pink janë sfonde/thekse; teksti mbi to është gjithmonë aubergine.
        om: {
          butter: "#FFE16A",
          "butter-soft": "#FFF1B8",
          aubergine: "#4C1845",
          "aubergine-deep": "#3A1035",
          pink: "#FF79BD",
          "pink-soft": "#FFE1F0",
          white: "#FFF8EE",
          surface: "#FFFFFF",
          "ink-soft": "#6E4D68",
          line: "#EEDFD3",
          wolt: "#009DE0",
          "wolt-ink": "#00243A",
        },

        // ── Tema "Mesnatë Alpine" — VETËM faqja publike /m/[slug] (brand restoranti) ──
        midnight: { DEFAULT: "#0f1720", soft: "#1a2530" },
        alpine: { gold: "#c9a24b", cream: "#f5f0e6" },
      },
      fontFamily: {
        // Platforma: Fredoka (tituj) + Nunito (UI/body), si faqet publike.
        display: ["var(--font-display)", "Fredoka", "system-ui", "sans-serif"],
        ui: ["var(--font-ui)", "Nunito", "system-ui", "sans-serif"],
        // Alias ekzistues (publik/legacy).
        heading: ["var(--font-heading)", "Fredoka", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "Nunito", "system-ui", "sans-serif"],
        // OnlineMenu.al (faqet publike).
        "om-display": ["Fredoka", "system-ui", "sans-serif"],
        "om-body": ["Nunito", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "24px",
        "card-sm": "20px",
        field: "16px",
      },
      boxShadow: {
        soft: "0 8px 24px rgb(25 45 30 / 0.06)",
        card: "0 1px 2px rgb(25 45 30 / 0.04), 0 8px 24px rgb(25 45 30 / 0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
