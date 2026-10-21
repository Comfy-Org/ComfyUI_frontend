export const COMPARE_MIN = 0
export const COMPARE_MAX = 100
const KEY_STEP = 2
const KEY_LARGE_STEP = 10

function clampPercent(value: number): number {
  return Math.min(COMPARE_MAX, Math.max(COMPARE_MIN, value))
}

export function positionFromPointer(
  clientX: number,
  bounds: { left: number; width: number }
): number {
  if (bounds.width <= 0) return COMPARE_MIN
  return clampPercent(((clientX - bounds.left) / bounds.width) * COMPARE_MAX)
}

export function stepPosition(
  current: number,
  key: string,
  shift = false
): number | undefined {
  const step = shift ? KEY_LARGE_STEP : KEY_STEP
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowDown':
      return clampPercent(current - step)
    case 'ArrowRight':
    case 'ArrowUp':
      return clampPercent(current + step)
    case 'Home':
      return COMPARE_MIN
    case 'End':
      return COMPARE_MAX
    default:
      return undefined
  }
}
