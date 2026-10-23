import a24 from '@/assets/palettes/a24.json' with { type: 'json' }
import arc from '@/assets/palettes/arc.json' with { type: 'json' }
import dark from '@/assets/palettes/dark.json' with { type: 'json' }
import fennec from '@/assets/palettes/fennec.json' with { type: 'json' }
import github from '@/assets/palettes/github.json' with { type: 'json' }
import hbo from '@/assets/palettes/hbo.json' with { type: 'json' }
import light from '@/assets/palettes/light.json' with { type: 'json' }
import netflix from '@/assets/palettes/netflix.json' with { type: 'json' }
import nord from '@/assets/palettes/nord.json' with { type: 'json' }
import silverside from '@/assets/palettes/silverside.json' with { type: 'json' }
import skeleton from '@/assets/palettes/skeleton.json' with { type: 'json' }
import solarized from '@/assets/palettes/solarized.json' with { type: 'json' }
import spooky from '@/assets/palettes/spooky.json' with { type: 'json' }
import warnerBros from '@/assets/palettes/warner-bros.json' with { type: 'json' }
import witch from '@/assets/palettes/witch.json' with { type: 'json' }
import zombie from '@/assets/palettes/zombie.json' with { type: 'json' }
import type {
  ColorPalettes,
  CompletedPalette
} from '@/schemas/colorPaletteSchema'

export const CORE_COLOR_PALETTES: ColorPalettes = {
  dark,
  light,
  solarized,
  arc,
  nord,
  github,
  spooky,
  skeleton,
  witch,
  zombie,
  fennec,
  netflix,
  'warner-bros': warnerBros,
  hbo,
  a24,
  silverside
} as const

export const DEFAULT_COLOR_PALETTE: CompletedPalette = dark
export const DEFAULT_DARK_COLOR_PALETTE: CompletedPalette = dark
export const DEFAULT_LIGHT_COLOR_PALETTE: CompletedPalette = light
