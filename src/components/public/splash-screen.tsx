import { ChefMascot, CHEF_BOX_ASSET_PATH } from "@/components/public/chef-mascot";
import { OmLogo } from "@/components/public/om-site-header";

/**
 * Ekrani i hapjes i miratuar — Splash B 05: "Shefi i Bukës në kutinë rozë".
 * Sfond rozë i butë, logo Aubergine, tri pika (rozë · aubergine · rozë), ilustrimi poshtë.
 * Përdoret nga loading.tsx (vetëm sa serveri përgatit faqen; pa vonesë artificiale).
 * Pikat ndalen me prefers-reduced-motion. Ilustrimi final vjen nga CHEF_BOX_ASSET_PATH kur regjistrohet.
 */
export function SplashScreen() {
  return (
    <div className="om-splash" role="status" aria-live="polite">
      <OmLogo size="lg" />
      <div className="om-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="om-splash-art">
        <ChefMascot variant="box" size={240} decorative priority />
      </div>
      <span className="sr-only">Duke hapur restorantin…</span>
    </div>
  );
}

export { CHEF_BOX_ASSET_PATH };
