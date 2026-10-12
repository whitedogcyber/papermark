// 1. Re-create the Currency type (usually 'usd' | 'eur', etc.)
export type Currency = 'usd' | 'eur' | 'gbp';

// 2. Map the currency labels
export const CURRENCY_LABEL: Record<Currency, string> = {
  usd: 'USD',
  eur: 'EUR',
  gbp: 'GBP',
};

// 3. Map the currency symbols
export const CURRENCY_SYMBOL: Record<Currency, string> = {
  usd: '$',
  eur: '€',
  gbp: '£',
};