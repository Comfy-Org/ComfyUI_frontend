export function formatNumberInput({
  raw,
  cursor,
  value,
  formatOptions,
  resetCursor
}: {
  raw: string
  cursor: number
  value: number
  formatOptions: Intl.NumberFormatOptions
  resetCursor: boolean
}): { formatted: string; newCursor: number } {
  const formatted = value.toLocaleString('en-US', formatOptions)
  const prefix = resetCursor ? formatted : raw.slice(0, cursor)
  const digitsBeforeCursor = prefix.replace(/[^0-9]/g, '').length

  let digitCount = 0
  let newCursor = 0
  for (let i = 0; i < formatted.length; i++) {
    if (/[0-9]/.test(formatted[i])) {
      digitCount++
    }
    if (digitCount >= digitsBeforeCursor) {
      newCursor = i + 1
      break
    }
  }

  if (digitCount < digitsBeforeCursor) {
    newCursor = formatted.length
  }

  return { formatted, newCursor }
}
