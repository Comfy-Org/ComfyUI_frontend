const CLEAR = 244
const SOLID = 222

function isLightOpaque(data: Uint8ClampedArray, index: number) {
  return (
    data[index + 3] === 255 &&
    Math.min(data[index], data[index + 1], data[index + 2]) >= SOLID
  )
}

/**
 * Clears a product shot's plain white backdrop in place, so a JPEG packshot
 * sits in the hand without a white card around it. Leaves the pixels alone
 * unless every corner is light and opaque. Returns whether it cleared any.
 */
export function clearWhiteBackdrop(
  data: Uint8ClampedArray,
  width: number,
  height: number
): boolean {
  if (width < 2 || height < 2) return false
  const corners = [0, width - 1, (height - 1) * width, height * width - 1]
  if (!corners.every((pixel) => isLightOpaque(data, pixel * 4))) return false
  for (let index = 0; index < data.length; index += 4) {
    const light = Math.min(data[index], data[index + 1], data[index + 2])
    if (light < SOLID) continue
    const kept = (CLEAR - Math.min(light, CLEAR)) / (CLEAR - SOLID)
    data[index + 3] = Math.round(data[index + 3] * kept)
  }
  return true
}
