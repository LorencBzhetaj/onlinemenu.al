// Shefi i Bukës — personazhi kryesor i brandit OnlineMenu.al.
//
// ASSET-ET FINALE MUNGOJNË: mockup-et janë vetëm referencë (s'priten si sprite). Kur ilustrimet e
// veçuara e të optimizuara (WebP/AVIF, sfond transparent) të jenë gati, vendosini te
// /public/brand/chef/ dhe regjistrojini te CHEF_ASSETS — komponenti i përdor automatikisht.
// Deri atëherë shfaqet një siluetë e thjeshtë vektoriale (bukë e rrumbullakët + kapele e bardhë +
// fytyrë miqësore) që ruan tiparet e personazhit, pa u prerë nga mockup-et.
//
// Rregull: maskota s'vendoset mbi fotot, çmimet apo përshkrimet e pjatave.

export type ChefVariant = "box" | "pizza" | "burger" | "fresh" | "sweets";

const CHEF_ASSETS: Partial<Record<ChefVariant, { src: string; width: number; height: number }>> = {
  // box: { src: "/brand/chef/chef-box.webp", width: 640, height: 640 },  // 05 — loading i miratuar
};

const LABELS: Record<ChefVariant, string> = {
  box: "Shefi i Bukës",
  pizza: "Shefi i Bukës me picë",
  burger: "Shefi i Bukës me burger",
  fresh: "Shefi i Bukës me sallatë",
  sweets: "Shefi i Bukës me ëmbëlsira",
};

export function ChefMascot({
  variant = "box",
  size = 120,
  decorative = false,
  className,
}: {
  variant?: ChefVariant;
  size?: number;
  decorative?: boolean;
  className?: string;
}) {
  const asset = CHEF_ASSETS[variant];
  const a11y = decorative ? { "aria-hidden": true as const } : { role: "img" as const, "aria-label": LABELS[variant] };

  if (asset) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={asset.src}
        width={size}
        height={Math.round((size * asset.height) / asset.width)}
        alt={decorative ? "" : LABELS[variant]}
        className={className}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={className} {...a11y}>
      {/* kapela */}
      <g fill="#FFFFFF" stroke="#4C1845" strokeWidth="2.5">
        <circle cx="44" cy="30" r="13" />
        <circle cx="60" cy="22" r="15" />
        <circle cx="76" cy="30" r="13" />
        <rect x="40" y="30" width="40" height="18" rx="5" />
      </g>
      {/* buka */}
      <ellipse cx="60" cy="76" rx="38" ry="34" fill="#F2C27B" stroke="#4C1845" strokeWidth="2.5" />
      <path d="M36 64c4-3 8-3 12 0M72 64c4-3 8-3 12 0" fill="none" stroke="#D9A35C" strokeWidth="2" strokeLinecap="round" />
      {/* fytyra */}
      <path d="M47 76c2-4 7-4 9 0M64 76c2-4 7-4 9 0" fill="none" stroke="#4C1845" strokeWidth="3" strokeLinecap="round" />
      <path d="M52 86c4 7 12 7 16 0" fill="#4C1845" stroke="#4C1845" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="42" cy="86" r="5" fill="#FF79BD" opacity="0.55" />
      <circle cx="78" cy="86" r="5" fill="#FF79BD" opacity="0.55" />
    </svg>
  );
}
