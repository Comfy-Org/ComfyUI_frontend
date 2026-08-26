export function formatQuoteMoney(
  cents: number,
  currency: string | undefined,
  locale: string
): string {
  if (!currency) return ''
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.toUpperCase()
  }).format(cents / 100)
}
