interface ParsedAmount {
  value: number
  invalid: boolean
}

const INVALID: ParsedAmount = { value: 0, invalid: true }

function normalizeLocaleDigits(raw: string, locale: string) {
  const digitFormat = new Intl.NumberFormat(locale, { useGrouping: false })
  let normalized = raw
  for (let digit = 0; digit <= 9; digit++) {
    normalized = normalized.split(digitFormat.format(digit)).join(String(digit))
  }
  return normalized
}

export function parseWholeNumber(raw: string, locale: string): ParsedAmount {
  const trimmed = raw.trim()
  if (trimmed === '') return { value: 0, invalid: false }

  const numberFormat = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0
  })
  const group = numberFormat
    .formatToParts(12_345)
    .find((part) => part.type === 'group')?.value
  const localized = normalizeLocaleDigits(trimmed, locale)
  const ungrouped = group ? localized.split(group).join('') : localized

  if (!/^\d+$/.test(ungrouped)) return INVALID

  const value = Number(ungrouped)
  if (!Number.isSafeInteger(value)) return INVALID

  if (group && localized.includes(group)) {
    const canonicalGrouped = normalizeLocaleDigits(
      numberFormat.format(value),
      locale
    )
    if (canonicalGrouped !== localized) return INVALID
  }

  return { value, invalid: false }
}

export function parseAmountInput(
  raw: string,
  locale: string,
  convert: (value: number) => number
): ParsedAmount {
  const parsed = parseWholeNumber(raw, locale)
  if (parsed.invalid) return parsed

  const value = convert(parsed.value)
  return Number.isSafeInteger(value) && value >= 0
    ? { value, invalid: false }
    : INVALID
}
