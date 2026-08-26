// Konverton një emër në slug URL-safe: "Restoranti Gjeçaj" -> "restoranti-gjecaj"
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // heq theksat
    .replace(/ç/g, "c")
    .replace(/ë/g, "e")
    .replace(/[^a-z0-9\s-]/g, "") // heq simbolet
    .replace(/\s+/g, "-") // hapësira -> viza
    .replace(/-+/g, "-") // viza të shumta -> një
    .replace(/^-+|-+$/g, ""); // heq vizat në skaje
}
