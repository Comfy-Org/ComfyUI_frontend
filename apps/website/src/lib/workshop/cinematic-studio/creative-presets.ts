import { validateCreativeSettings } from './creative'
import type { CreativeSettings } from './creative'

export type CreativePresetKind = 'palette' | 'lighting'

export function applyCreativePresetPart(
  current: CreativeSettings,
  saved: CreativeSettings,
  kind: CreativePresetKind
): CreativeSettings {
  const next = validateCreativeSettings(current)
  const preset = validateCreativeSettings(saved)
  return kind === 'palette'
    ? { ...next, palette: preset.palette, paletteMain: preset.paletteMain }
    : { ...next, lights: preset.lights }
}
