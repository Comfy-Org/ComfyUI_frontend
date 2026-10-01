import type { Light, RelightMaskArea, RelightScene } from './lights'
import { MAX_LIGHTS } from './lights'

/** `#rrggbb` as 0 to 1 channels; anything unreadable is white. */
export function hexToRgb(hex: string): [number, number, number] {
  const match = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex)
  if (!match) return [1, 1, 1]
  const channel = (pair: string) => parseInt(pair, 16) / 255
  return [channel(match[1]), channel(match[2]), channel(match[3])]
}

/**
 * The unit vector toward a directional light, in image space (x right,
 * y down, z out of the photo toward the viewer).
 */
export function towardLight(
  direction: number,
  elevation: number
): [number, number, number] {
  const azimuth = (direction * Math.PI) / 180
  const lift = (elevation * Math.PI) / 180
  const flat = Math.cos(lift)
  return [-Math.cos(azimuth) * flat, -Math.sin(azimuth) * flat, Math.sin(lift)]
}

export interface HeightMap {
  readonly width: number
  readonly height: number
  /** One byte a pixel, row by row from the top. */
  readonly data: Uint8Array
}

function boxBlur(
  source: Float32Array,
  width: number,
  height: number,
  radius: number
): Float32Array {
  const across = new Float32Array(source.length)
  const out = new Float32Array(source.length)
  const span = radius * 2 + 1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      for (let k = -radius; k <= radius; k++)
        sum += source[y * width + Math.min(width - 1, Math.max(0, x + k))]
      across[y * width + x] = sum / span
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      for (let k = -radius; k <= radius; k++)
        sum += across[Math.min(height - 1, Math.max(0, y + k)) * width + x]
      out[y * width + x] = sum / span
    }
  }
  return out
}

/**
 * A pseudo height map from a photo's pixels: brighter reads as nearer, then
 * blurred twice so its slopes describe forms rather than texture. The
 * preview derives surface normals from its gradients.
 */
export function heightMap(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  radius = 2
): HeightMap {
  const luminance = new Float32Array(width * height)
  for (let i = 0; i < luminance.length; i++)
    luminance[i] =
      (rgba[i * 4] * 0.2126 +
        rgba[i * 4 + 1] * 0.7152 +
        rgba[i * 4 + 2] * 0.0722) /
      255
  const blurred = boxBlur(
    boxBlur(luminance, width, height, radius),
    width,
    height,
    radius
  )
  return {
    width,
    height,
    data: Uint8Array.from(blurred, (value) => Math.round(value * 255))
  }
}

/** The numbers the shader reads, four slots per light, unused slots zero. */
export interface ShadingUniforms {
  readonly count: number
  /** x, y, directional (0 or 1), energy. */
  readonly position: Float32Array
  /** r, g, b, softness 0 to 1. */
  readonly color: Float32Array
  /** Toward-light x, y, z, casts shadows (0 or 1). */
  readonly toward: Float32Array
  /** Mask centre x, y and radii; a zero radius lights the whole image. */
  readonly mask: Float32Array
  readonly ambient: readonly [number, number, number]
  readonly remove: number
  readonly reflections: number
}

/** Visible lights, their masks and the scene, packed for the shader. */
export function shadingUniforms(
  lights: readonly Light[],
  masks: readonly RelightMaskArea[],
  scene: RelightScene
): ShadingUniforms {
  const shown = lights.filter((light) => light.visible).slice(0, MAX_LIGHTS)
  const size = MAX_LIGHTS * 4
  const position = new Float32Array(size)
  const color = new Float32Array(size)
  const toward = new Float32Array(size)
  const mask = new Float32Array(size)
  shown.forEach((light, index) => {
    const at = index * 4
    const directional = light.kind === 'directional'
    position.set(
      [light.x, light.y, directional ? 1 : 0, (light.intensity / 100) * 1.6],
      at
    )
    color.set([...hexToRgb(light.color), light.softness / 100], at)
    toward.set(
      [...towardLight(light.direction, light.elevation), light.shadows ? 1 : 0],
      at
    )
    const area = masks.find((candidate) => candidate.id === light.mask)
    if (area) mask.set([area.cx, area.cy, area.rx, area.ry], at)
  })
  const [r, g, b] = hexToRgb(scene.ambientColor)
  const lift = (scene.ambient / 100) * 0.9
  return {
    count: shown.length,
    position,
    color,
    toward,
    mask,
    ambient: [r * r * lift, g * g * lift, b * b * lift],
    remove: scene.removeOriginal / 100,
    reflections: scene.reflections / 100
  }
}
