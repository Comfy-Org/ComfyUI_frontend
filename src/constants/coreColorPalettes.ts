import dark from '@/assets/palettes/dark.json'
import light from '@/assets/palettes/light.json'
import solarized from '@/assets/palettes/solarized.json'
import arc from '@/assets/palettes/arc.json'
import nord from '@/assets/palettes/nord.json'
import github from '@/assets/palettes/github.json'
import type { ColorPalettes } from '@/types/colorPaletteTypes'

export const CORE_COLOR_PALETTES: ColorPalettes = {
  dark,
  light,
  solarized,
  arc,
  nord,
  github
} as const
