/**
 * Fixed conversion rate between USD and Comfy credits.
 * 1 credit costs 210 cents ($2.10).
 */
export const COMFY_CREDIT_RATE_CENTS = 210

export const COMFY_CREDIT_RATE_USD = COMFY_CREDIT_RATE_CENTS / 100

const DEFAULT_NUMBER_FORMAT: Intl.NumberFormatOptions = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}

const formatNumber = (
  value: number,
  options: Intl.NumberFormatOptions = DEFAULT_NUMBER_FORMAT,
  locale?: string
) => {
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

export const centsToUsd = (cents: number): number => cents / 100
export const usdToCents = (usd: number): number => Math.round(usd * 100)

/**
 * Converts a USD amount into Comfy credits.
 */
export function usdToComfyCredits(usd: number): number {
  return usd / COMFY_CREDIT_RATE_USD
}

/**
 * Converts USD cents into Comfy credits.
 */
export function centsToComfyCredits(cents: number): number {
  return cents / COMFY_CREDIT_RATE_CENTS
}

/**
 * Converts Comfy credits back to USD.
 */
export function comfyCreditsToUsd(credits: number): number {
  return credits * COMFY_CREDIT_RATE_USD
}

/**
 * Converts Comfy credits to cents.
 */
export function comfyCreditsToCents(credits: number): number {
  return credits * COMFY_CREDIT_RATE_CENTS
}

export function formatUsdFromCents(
  cents: number,
  options?: Intl.NumberFormatOptions,
  locale?: string
): string {
  return formatNumber(
    centsToUsd(cents),
    { ...DEFAULT_NUMBER_FORMAT, ...options },
    locale
  )
}

/**
 * Formats credits to a localized numeric string (no unit suffix).
 */
export function formatComfyCreditsAmount(
  credits: number,
  options?: Intl.NumberFormatOptions,
  locale?: string
): string {
  return formatNumber(credits, { ...DEFAULT_NUMBER_FORMAT, ...options }, locale)
}

type FormatCreditsOptions = {
  unit?: string | null
  numberOptions?: Intl.NumberFormatOptions
  locale?: string
}

export function formatComfyCreditsLabel(
  credits: number,
  { unit = 'credits', numberOptions, locale }: FormatCreditsOptions = {}
): string {
  const formatted = formatComfyCreditsAmount(credits, numberOptions, locale)
  return unit ? `${formatted} ${unit}` : formatted
}

export function formatComfyCreditsLabelFromCents(
  cents: number,
  options?: FormatCreditsOptions
): string {
  return formatComfyCreditsLabel(centsToComfyCredits(cents), options)
}

export function formatComfyCreditsLabelFromUsd(
  usd: number,
  options?: FormatCreditsOptions
): string {
  return formatComfyCreditsLabel(usdToComfyCredits(usd), options)
}

export function formatComfyCreditsRangeLabelFromUsd(
  minUsd: number,
  maxUsd: number,
  {
    unit = 'credits',
    numberOptions,
    locale,
    separator = '–'
  }: FormatCreditsOptions & {
    separator?: string
  } = {}
): string {
  const min = formatComfyCreditsAmount(
    usdToComfyCredits(minUsd),
    numberOptions,
    locale
  )
  const max = formatComfyCreditsAmount(
    usdToComfyCredits(maxUsd),
    numberOptions,
    locale
  )
  const joined = `${min}${separator}${max}`
  return unit ? `${joined} ${unit}` : joined
}

const USD_RANGE_REGEX = /(~?)\$(\d+(?:\.\d+)?)\s*[-–]\s*\$?(\d+(?:\.\d+)?)/g
const USD_VALUE_REGEX = /(~?)\$(\d+(?:\.\d+)?)/g

/**
 * Converts a USD-denoted string (e.g., "$0.45-1.2/Run") into a credits string.
 * Any "$X" occurrences become "Y credits". Ranges are rendered as "Y–Z credits".
 */
export function convertUsdLabelToCredits(
  label: string,
  options?: FormatCreditsOptions
): string {
  if (!label) return label
  const unit = options?.unit ?? 'credits'
  const numberOptions = options?.numberOptions
  const locale = options?.locale

  const formatSingle = (usd: number) =>
    formatComfyCreditsLabel(usdToComfyCredits(usd), {
      unit,
      numberOptions,
      locale
    })

  const formatRange = (min: number, max: number, prefix = '') => {
    const minStr = formatComfyCreditsAmount(
      usdToComfyCredits(min),
      numberOptions,
      locale
    )
    const maxStr = formatComfyCreditsAmount(
      usdToComfyCredits(max),
      numberOptions,
      locale
    )
    const joined = `${minStr}–${maxStr}`
    return unit ? `${prefix}${joined} ${unit}` : `${prefix}${joined}`
  }

  let converted = label
  converted = converted.replace(
    USD_RANGE_REGEX,
    (_match, prefix = '', minUsd, maxUsd) =>
      formatRange(parseFloat(minUsd), parseFloat(maxUsd), prefix)
  )

  converted = converted.replace(
    USD_VALUE_REGEX,
    (_match, prefix = '', amount) => {
      const formatted = formatSingle(parseFloat(amount))
      return `${prefix}${formatted}`
    }
  )

  return converted
}
