import type { AccessErrorCode } from "@/modules/memberships/access";

// Mesazh i unifikuar kur një faqe private s'mund të shfaqet (pa restorant ose pa leje).
export function DashboardNotice({ reason }: { reason: AccessErrorCode }) {
  const text =
    reason === "forbidden"
      ? "Roli yt nuk ka akses te kjo faqe."
      : reason === "no_membership" || reason === "bad_request"
        ? "Nuk u gjet asnjë restorant i lidhur me këtë llogari."
        : "I paautorizuar.";
  return (
    <div className="rounded-lg border border-alpine-cream/10 bg-midnight-soft p-6 text-alpine-cream/70">
      {text}
    </div>
  );
}
