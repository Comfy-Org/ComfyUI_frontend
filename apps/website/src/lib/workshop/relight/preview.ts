import type { Light, RelightScene } from './lights'
import { lightHex } from './lights'

export interface PreviewGlow {
  readonly id: string
  readonly style: {
    readonly backgroundImage: string
    readonly opacity: number
    readonly mixBlendMode: 'screen' | 'soft-light'
  }
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

/**
 * How dark to lay a shade over the photo before the new lights: more as
 * the original lighting is removed or shadows are cast, less with ambient.
 */
export function previewShade(scene: RelightScene): number {
  const shade =
    (scene.removeOriginal / 100) * 0.55 +
    (scene.shadows ? 0.12 : 0) -
    (scene.ambient / 100) * 0.3
  return clamp(shade, 0, 0.7)
}

/**
 * A CSS stand-in for each visible light: a radial glow at its position in
 * its color, wider when softer, stronger when brighter. A directional light
 * reaches further and tints (soft light) rather than adds (screen).
 */
export function previewGlows(lights: readonly Light[]): PreviewGlow[] {
  return lights
    .filter((light) => light.visible)
    .map((light) => {
      const reach =
        (light.kind === 'directional' ? 45 : 22) + light.softness * 0.5
      const at = `${light.x * 100}% ${light.y * 100}%`
      return {
        id: light.id,
        style: {
          backgroundImage: `radial-gradient(ellipse ${reach}% ${reach}% at ${at}, ${lightHex(light.color)} 0%, transparent 100%)`,
          opacity: clamp(light.brightness / 100, 0, 1),
          mixBlendMode: light.kind === 'directional' ? 'soft-light' : 'screen'
        }
      }
    })
}
