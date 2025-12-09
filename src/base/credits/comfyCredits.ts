const DEFAULT_NUMBER_FORMAT: Intl.NumberFormatOptions = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}

const formatNumber = ({
  value,
  locale,
  options
}: {
  value: number
  locale?: string
  options?: Intl.NumberFormatOptions
}): string => {
  const merged: Intl.NumberFormatOptions = {
    ...DEFAULT_NUMBER_FORMAT,
    ...options
  }

  if (
    typeof merged.maximumFractionDigits === 'number' &&
    typeof merged.minimumFractionDigits === 'number' &&
    merged.maximumFractionDigits < merged.minimumFractionDigits
  ) {
    merged.minimumFractionDigits = merged.maximumFractionDigits
  }

  return new Intl.NumberFormat(locale, merged).format(value)
}

export const CREDITS_PER_USD = 210
export const COMFY_CREDIT_RATE_CENTS = CREDITS_PER_USD / 100 // credits per cent

export const usdToCents = (usd: number): number => Math.round(usd * 100)

export const centsToCredits = (cents: number): number =>
  Math.round(cents * COMFY_CREDIT_RATE_CENTS)

export const creditsToCents = (credits: number): number =>
  Math.round(credits / COMFY_CREDIT_RATE_CENTS)

export const usdToCredits = (usd: number): number =>
  Math.round(usd * CREDITS_PER_USD)

export const creditsToUsd = (credits: number): number =>
  Math.round((credits / CREDITS_PER_USD) * 100) / 100

export type FormatOptions = {
  value: number
  locale?: string
  numberOptions?: Intl.NumberFormatOptions
}

export const formatCredits = ({
  value,
  locale,
  numberOptions
}: FormatOptions): string =>
  formatNumber({ value, locale, options: numberOptions })

export const formatCreditsFromCents = ({
  cents,
  locale,
  numberOptions
}: {
  cents: number
  locale?: string
  numberOptions?: Intl.NumberFormatOptions
}): string =>
  formatCredits({
    value: centsToCredits(cents),
    locale,
    numberOptions
  })

export const formatCreditsFromUsd = ({
  usd,
  locale,
  numberOptions
}: {
  usd: number
  locale?: string
  numberOptions?: Intl.NumberFormatOptions
}): string =>
  formatCredits({
    value: usdToCredits(usd),
    locale,
    numberOptions
  })

export const formatUsd = ({
  value,
  locale,
  numberOptions
}: FormatOptions): string =>
  formatNumber({
    value,
    locale,
    options: numberOptions
  })

export const formatUsdFromCents = ({
  cents,
  locale,
  numberOptions
}: {
  cents: number
  locale?: string
  numberOptions?: Intl.NumberFormatOptions
}): string =>
  formatUsd({
    value: cents / 100,
    locale,
    numberOptions
  })
