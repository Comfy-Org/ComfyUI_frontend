import arc from './presets/arc.json' with { type: 'json' }
import classic from './presets/classic.json' with { type: 'json' }
import dark from './presets/dark.json' with { type: 'json' }
import fennec from './presets/fennec.json' with { type: 'json' }
import github from './presets/github.json' with { type: 'json' }
import light from './presets/light.json' with { type: 'json' }
import nord from './presets/nord.json' with { type: 'json' }
import solarized from './presets/solarized.json' with { type: 'json' }
import type { CompletedThemePreset, ThemePresets } from './themePresetSchema'

export const BUILT_IN_THEME_PRESETS: ThemePresets = {
  dark,
  light,
  classic,
  solarized,
  arc,
  nord,
  github,
  fennec
}

export const DEFAULT_THEME_PRESET: CompletedThemePreset = dark
export const DEFAULT_DARK_THEME_PRESET: CompletedThemePreset = dark
export const DEFAULT_LIGHT_THEME_PRESET: CompletedThemePreset = light
