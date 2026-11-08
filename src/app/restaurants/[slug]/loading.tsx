import { ChefMascot } from "@/components/public/chef-mascot";
import { OmLogo } from "@/components/public/om-site-header";
import "@/components/public/om-public.css";

// Loading i miratuar (05): Shefi i Bukës në kutinë rozë + logo Aubergine + tri pika.
// Shfaqet VETËM sa serveri përgatit faqen (QR → profil hapet direkt, pa vonesë artificiale).
// Lëvizja e pikave ndalet me prefers-reduced-motion.
export default function RestaurantLoading() {
  return (
    <div className="om-splash" role="status" aria-live="polite">
      <OmLogo size="lg" />
      <div className="om-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <ChefMascot variant="box" size={168} decorative />
      <span className="sr-only">Duke hapur restorantin…</span>
    </div>
  );
}
