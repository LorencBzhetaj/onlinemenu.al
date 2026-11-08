"use client";

// Pëlqimi për matjen + ngarkimi i GTM-së VETËM pas "Prano".
// - Pa zgjedhje ose me "Refuzo": GTM s'ngarkohet fare (asnjë kërkesë te Google, asnjë cookie analitike).
// - Me "Prano": dataLayer inicializohet, vendoset gjendja e pëlqimit, pastaj ngarkohet gtm.js (snippet-i zyrtar).
//   Nuk shtohet gtag.js paralel: GA4 menaxhohet brenda kontejnerit GTM.
// - Ndryshimi nga "Prano" në "Refuzo": fshihen cookies _ga* të domenit dhe faqja ringarkohet pa GTM.
// - Mos dërgo kurrë në dataLayer email, telefona, të dhëna rezervimesh, token-e apo URL private.
import { useCallback, useEffect, useState } from "react";
import { GTM_ID } from "@/lib/site-config";

type Choice = "granted" | "denied";
const KEY = "om-analytics-consent-v1";

declare global {
  interface Window {
    dataLayer?: unknown[];
    __omGtmLoaded?: boolean;
  }
}

function readChoice(): Choice | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

function saveChoice(v: Choice) {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* ruajtja mund të jetë e bllokuar; zgjedhja vlen për këtë faqe */
  }
}

function loadGtm() {
  if (window.__omGtmLoaded) return;
  window.__omGtmLoaded = true;
  window.dataLayer = window.dataLayer || [];
  // eslint-disable-next-line prefer-rest-params
  const gtag = function (..._args: unknown[]) { window.dataLayer!.push(arguments); };
  gtag("consent", "default", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  // Snippet-i zyrtar i GTM.
  window.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
  const first = document.getElementsByTagName("script")[0];
  first?.parentNode?.insertBefore(s, first);
}

function clearAnalyticsCookies() {
  const host = location.hostname;
  const domains = ["", host, `.${host}`, `.${host.replace(/^www\./, "")}`];
  document.cookie.split(";").forEach((c) => {
    const name = c.split("=")[0].trim();
    if (!/^_ga|^_gid|^_gat/.test(name)) return;
    domains.forEach((d) => {
      document.cookie = `${name}=; Max-Age=0; path=/${d ? `; domain=${d}` : ""}`;
    });
  });
}

export function ConsentAndGtm() {
  const [choice, setChoice] = useState<Choice | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const c = readChoice();
    setChoice(c);
    setOpen(c === null);
    setReady(true);
    if (c === "granted") loadGtm();
  }, []);

  const accept = useCallback(() => {
    saveChoice("granted");
    setChoice("granted");
    setOpen(false);
    loadGtm();
  }, []);

  const reject = useCallback(() => {
    const wasLoaded = Boolean(window.__omGtmLoaded);
    saveChoice("denied");
    setChoice("denied");
    setOpen(false);
    if (wasLoaded) {
      clearAnalyticsCookies();
      location.reload(); // GTM s'mund të çngarkohet; ringarkimi e heq plotësisht
    }
  }, []);

  if (!ready) return null;

  return (
    <>
      {open && (
        <div className="cs-consent" role="dialog" aria-modal="false" aria-labelledby="cs-consent-title">
          <p id="cs-consent-title">
            <strong>Matja e vizitave.</strong> Me pëlqimin tuaj përdorim Google Tag Manager dhe Google Analytics për të numëruar
            vizitat e kësaj faqeje. Pa pëlqim nuk ngarkohet asnjë mjet matjeje.
          </p>
          <div className="cs-consent-actions">
            <button type="button" className="accept" onClick={accept}>
              Prano
            </button>
            <button type="button" className="reject" onClick={reject}>
              Refuzo
            </button>
          </div>
        </div>
      )}
      {!open && (
        <button type="button" className="cs-consent-reopen" onClick={() => setOpen(true)} aria-label="Ndrysho zgjedhjen për matjen">
          Cookies: {choice === "granted" ? "të pranuara" : "të refuzuara"}
        </button>
      )}
    </>
  );
}
