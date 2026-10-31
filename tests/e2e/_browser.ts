/*
 * Nisje e RIPRODHUESHME e Chromium për testet E2E — pa path absolut në kod.
 *
 * - Importi përdor specifier-in e paketës `playwright` (e deklaruar në devDependencies),
 *   jo një path absolut specifik të një makine.
 * - Binarin e shfletuesit:
 *     • Default → shfletuesi i menaxhuar nga Playwright (pas `npx playwright install chromium`).
 *     • Override → nëse `PLAYWRIGHT_EXECUTABLE_PATH` është vendosur (p.sh. CI/container me
 *       Chromium të para-instaluar), përdoret ai binar. Në këtë mjedis:
 *       PLAYWRIGHT_EXECUTABLE_PATH=/opt/pw-browsers/chromium
 */
import { chromium, type Browser } from "playwright";

export { chromium };
export type { Browser };

export function launchBrowser(): Promise<Browser> {
  const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH?.trim();
  return chromium.launch(executablePath ? { executablePath } : {});
}
