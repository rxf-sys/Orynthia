export const CATEGORY_PALETTE = [
  '#424769',
  '#ffb17a',
  '#5b8def',
  '#1f8a5b',
  '#b97aff',
  '#e76b8d',
  '#3aa3a5',
  '#d99a2b',
];

export function pickCategoryColor(seed?: string | null) {
  if (!seed) return CATEGORY_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return CATEGORY_PALETTE[hash % CATEGORY_PALETTE.length];
}
