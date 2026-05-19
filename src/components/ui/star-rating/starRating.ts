export function clampRating(value: number, max: number): number {
  return Math.min(Math.max(0, Math.round(value)), max)
}

export function getDisplayRating(
  committed: number,
  hover: number | null
): number {
  return hover ?? committed
}

export function getRatingFromStarClick(
  committed: number,
  clicked: number
): number {
  return committed === clicked ? 0 : clicked
}

export function isStarFilled(
  starIndex: number,
  displayRating: number
): boolean {
  return starIndex <= displayRating
}

export function getRatingFromDigitKey(key: string, max: number): number | null {
  if (key === '0') return 0
  const digit = Number.parseInt(key, 10)
  if (Number.isNaN(digit) || digit < 1 || digit > max) return null
  return digit
}
