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
        // ── Design system i platformës (Faza 2): krem/jeshile, i butë ──
        canvas: "#FAF8F3", // sfondi krem
        surface: "#FFFFFF", // kartat
        ink: "#20241F", // teksti kryesor
        muted: "#62685F", // teksti dytësor
        line: "#E8E3D7", // kontura delikate
        primary: {
          DEFAULT: "#164B36", // jeshile (butona, theks veprimi)
          dark: "#0F3A29",
          soft: "#E7EFEA", // sfond i butë jeshil (badge/hover)
        },
        accent: "#A77932", // ar — detaje delikate (jo veprime)

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
        // Platforma: Playfair Display (tituj) + Jost (UI/body).
        display: ["var(--font-display)", "Playfair Display", "Georgia", "serif"],
        ui: ["var(--font-ui)", "Jost", "system-ui", "sans-serif"],
        // Alias ekzistues (publik/legacy).
        heading: ["var(--font-heading)", "Playfair Display", "serif"],
        body: ["var(--font-body)", "Jost", "sans-serif"],
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
