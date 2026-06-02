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

let cached

/**
 * Load the comfy icon folder as a normalized Iconify icon set.
 *
 * Mirrors the pipeline that `@plugin "@iconify/tailwind4" { from-folder(...) }`
 * runs internally so monotone hardcoded colors become `currentColor` and
 * outer-svg attributes like `fill="none"` survive the body extraction.
 */
export function loadComfyIconSet() {
  if (cached) return cached
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
      runSVGO(svg)
      iconSet.fromSVG(name, svg)
    } catch {
      iconSet.remove(name)
    }
  })
  cached = iconSet.export()
  return cached
}
