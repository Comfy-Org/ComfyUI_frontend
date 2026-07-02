import {
  cleanupSVG,
  importDirectorySync,
  isEmptyColor,
  parseColors,
  runSVGO
} from '@iconify/tools'
import { resolve } from 'node:path'

export const COMFY_ICON_PREFIX = 'comfy'

const COMFY_ICONS_DIR = resolve(import.meta.dirname, '../icons')

const PRESERVE_COLOR_ICONS = new Set(['claude', 'bria'])

let cached
let cachedRaw

function buildIconSet(preserveAllColors) {
  const iconSet = importDirectorySync(COMFY_ICONS_DIR)
  iconSet.forEachSync((name, type) => {
    if (type !== 'icon') return
    const svg = iconSet.toSVG(name)
    if (!svg) {
      iconSet.remove(name)
      return
    }
    try {
      cleanupSVG(svg)
      if (!preserveAllColors && !PRESERVE_COLOR_ICONS.has(name)) {
        const palette = parseColors(svg)
        const colors = palette.colors.filter(
          (color) => typeof color === 'string' || !isEmptyColor(color)
        )
        const totalColors = colors.length + (palette.hasUnsetColor ? 1 : 0)
        if (totalColors < 2) {
          parseColors(svg, {
            defaultColor: 'currentColor',
            callback: (_attr, colorStr, color) =>
              !color || isEmptyColor(color) ? colorStr : 'currentColor'
          })
        }
      }
      runSVGO(svg)
      iconSet.fromSVG(name, svg)
    } catch {
      iconSet.remove(name)
    }
  })
  return iconSet.export()
}

export function loadComfyIconSet() {
  return (cached ??= buildIconSet(false))
}

export function loadComfyIconSetRaw() {
  return (cachedRaw ??= buildIconSet(true))
}
