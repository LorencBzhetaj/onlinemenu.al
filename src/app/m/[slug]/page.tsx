import { redirect } from "next/navigation";

// Alias historik: QR-të e printuara te `/m/[slug]` ruhen funksionale, por tani
// hapin PROFILIN e restorantit (jo menunë direkt). Slug-u mbetet i njëjtë.
export const dynamic = "force-dynamic";

export default function LegacyMenuPage({ params }: { params: { slug: string } }) {
  redirect(`/restaurants/${params.slug}`);
}
