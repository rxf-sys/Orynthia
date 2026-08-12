/**
 * Wertfreie kategoriale Skala – die einzige Quelle dieser Farben.
 *
 * Bewusst **ohne Grün und ohne Rot**: in einem Kategorie-Donut oder einer
 * Depot-Allokation soll niemand eine Bewertung mitlesen. Wertende Farben
 * gehören ausschließlich zur Status-Achse (siehe `lib/status.ts`).
 *
 * `tailwind.config.ts` importiert diese Liste für die `cat-1…8`-Utilities,
 * damit es keine zweite, driftende Kopie gibt.
 */
export const CATEGORY_PALETTE: string[] = [
  '#7c5cff',
  '#2f7dff',
  '#3aa3a5',
  '#8a92ab',
  '#b97aff',
  '#4d6bd8',
  '#5f7f9c',
  '#6f5aa8',
];

/** Farbe für „Sonstige“-Sammelsegmente – keine Skalenfarbe, damit sie nicht wie eine Kategorie wirkt. */
export const CATEGORY_REST_COLOR = 'var(--text-4)';

export function pickCategoryColor(seed?: string | null) {
  if (!seed) return CATEGORY_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return CATEGORY_PALETTE[hash % CATEGORY_PALETTE.length];
}
