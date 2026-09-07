import { cleanupSVG, importDirectorySync, runSVGO } from '@iconify/tools'
import { resolve } from 'node:path'

export const COMFY_ICON_PREFIX = 'comfy'

const COMFY_ICONS_DIR = resolve(import.meta.dirname, '../icons')

let cached

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
      runSVGO(svg)
      iconSet.fromSVG(name, svg)
    } catch {
      iconSet.remove(name)
    }
  })
  cached = iconSet.export()
  return cached
}
