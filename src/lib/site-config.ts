// Konfigurimi i faqes "Së shpejti" në Production (dega coming-soon-production).

/** Domeni kanonik i verifikuar në Vercel (onlinemenu.al → 308 → www.onlinemenu.al). */
export const SITE_URL = "https://www.onlinemenu.al";

/** Vetëm deploy-i Production i Vercel indeksohet; Preview/zhvillimi mbeten noindex. */
export function isProductionDeploy(): boolean {
  return process.env.VERCEL_ENV === "production";
}

/**
 * GTM: kontejneri zyrtar. Matja mbetet E FIKUR derisa:
 *  1) të miratohet konfigurimi i privatësisë/cookies për Production, dhe
 *  2) të vendoset NEXT_PUBLIC_ANALYTICS_ENABLED=1 për Production.
 * Edhe kur ndizet, GTM ngarkohet vetëm pasi vizitori klikon "Prano".
 */
export const GTM_ID = "GTM-WGNJNLHT";
export function analyticsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === "1";
}
