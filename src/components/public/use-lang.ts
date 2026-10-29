"use client";

import { useEffect, useState } from "react";

export type Lang = "al" | "en";
const STORAGE_KEY = "menu-lang";

/** Gjuha e faqeve publike: default 'al' (SSR-safe), pastaj sinkronizohet me localStorage. */
export function useLang() {
  const [lang, setLang] = useState<Lang>("al");
  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s === "al" || s === "en") setLang(s);
    } catch {
      /* private mode */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = lang === "al" ? "sq" : "en";
  }, [lang]);
  return { lang, setLang };
}
