export const MARKETPLACE_FILTER_OPTIONS = [
  { label: 'Amazon', value: 'Amazon' },
  { label: 'Flipkart', value: 'Flipkart' },
  { label: 'Blinkit', value: 'Blinkit' },
] as const;

export type MarketplaceSource = (typeof MARKETPLACE_FILTER_OPTIONS)[number]['value'];

export function matchesMarketplaceFilter(
  source: string | null | undefined,
  selected: string | null
): boolean {
  if (!selected) return true;
  if (!source?.trim()) return false;
  return source.trim().toLowerCase() === selected.toLowerCase();
}
