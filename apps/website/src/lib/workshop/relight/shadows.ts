import type { Light } from './lights'

export const SHADOW_STYLES = ['none', 'soft', 'hard', 'long'] as const
export type ShadowStyle = (typeof SHADOW_STYLES)[number]

const LOW_SUN = 20

/** The shadow look the visible lights add up to, read off their settings. */
export function shadowStyle(lights: readonly Light[]): ShadowStyle {
  const casting = lights.filter((light) => light.visible && light.shadows)
  if (!casting.length) return 'none'
  if (
    casting.some(
      (light) => light.kind === 'directional' && light.elevation <= LOW_SUN
    )
  )
    return 'long'
  const softness =
    casting.reduce((sum, light) => sum + light.softness, 0) / casting.length
  return softness >= 50 ? 'soft' : 'hard'
}

const LOOKS = {
  none: { shadows: false },
  soft: { shadows: true, softness: 70, lift: 35 },
  hard: { shadows: true, softness: 15, lift: 35 },
  long: { shadows: true, softness: 35, lift: 12 }
} as const satisfies Record<
  ShadowStyle,
  { shadows: boolean; softness?: number; lift?: number }
>

/**
 * Every light set to a shadow look: on or off, how soft, and for a long
 * shadow a low directional light. Fine-tuning stays on each light.
 */
export function withShadowStyle(
  lights: readonly Light[],
  style: ShadowStyle
): Light[] {
  const look: { shadows: boolean; softness?: number; lift?: number } =
    LOOKS[style]
  return lights.map((light) => ({
    ...light,
    shadows: look.shadows,
    softness: look.softness ?? light.softness,
    elevation:
      light.kind === 'directional' && look.lift !== undefined
        ? look.lift
        : light.elevation
  }))
}
