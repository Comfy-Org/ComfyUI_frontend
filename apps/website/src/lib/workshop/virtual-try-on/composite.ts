const SHADE = { level: 0.82, curve: 0.8, min: 0.12, max: 1.08 }
const EDGE_DARKEN = 0.3

const luminance = (pixels: Uint8ClampedArray, i: number) =>
  pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114

/**
 * Dresses RGBA `person` in `fabric` where `mask` is opaque. The fabric
 * keeps the photo's folds and light: each pixel is shaded by how bright
 * the photo is there against the masked average, and darkened towards the
 * garment's edge where `edge` (a wider, softer mask) fades.
 */
export function dressPixels(
  person: Uint8ClampedArray,
  fabric: Uint8ClampedArray,
  mask: Uint8ClampedArray,
  edge: Uint8ClampedArray
): Uint8ClampedArray<ArrayBuffer> {
  let weighted = 0
  let total = 0
  for (let i = 0; i < person.length; i += 4) {
    const weight = mask[i + 3] / 255
    weighted += luminance(person, i) * weight
    total += weight
  }
  const average = total ? weighted / total : 0
  const out = new Uint8ClampedArray(person)
  if (!average) return out
  for (let i = 0; i < person.length; i += 4) {
    const cover = mask[i + 3] / 255
    if (!cover) continue
    const lit = Math.pow(luminance(person, i) / average, SHADE.curve)
    const inset = Math.min(1, Math.max(0, (edge[i + 3] / 255) * 1.6 - 0.3))
    const shade =
      Math.min(SHADE.max, Math.max(SHADE.min, SHADE.level * lit)) *
      (1 - EDGE_DARKEN + EDGE_DARKEN * inset)
    for (let c = 0; c < 3; c++)
      out[i + c] = person[i + c] * (1 - cover) + fabric[i + c] * shade * cover
  }
  return out
}
