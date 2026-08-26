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
        // Tema default "Mesnatë Alpine" (nga projekti Gjeçaj) — çdo restorant
        // e mbivendos këtë dinamikisht përmes CSS variables në faqen publike.
        midnight: {
          DEFAULT: "#0f1720",
          soft: "#1a2530",
        },
        alpine: {
          gold: "#c9a24b",
          cream: "#f5f0e6",
        },
      },
      fontFamily: {
        heading: ["var(--font-heading)", "Playfair Display", "serif"],
        body: ["var(--font-body)", "Cormorant Garamond", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
