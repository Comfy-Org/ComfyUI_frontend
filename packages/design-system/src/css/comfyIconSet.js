import { readdirSync, readFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'

export const COMFY_ICON_PREFIX = 'comfy'

const COMFY_ICONS_DIR = resolve(import.meta.dirname, '../icons')

let cached

export function loadComfyIconSet() {
  if (cached) return cached
  const icons = {}
  for (const file of readdirSync(COMFY_ICONS_DIR)) {
    if (!file.endsWith('.svg')) continue
    const name = basename(file, '.svg')
    const svg = readFileSync(join(COMFY_ICONS_DIR, file), 'utf8')
    const svgMatch = svg.match(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/i)
    if (!svgMatch) continue
    const viewBox = svgMatch[1].match(/\bviewBox=(['"])(.*?)\1/i)?.[2]
    const viewBoxMatch = viewBox?.match(
      /^(?:-?\d*\.?\d+)\s+(?:-?\d*\.?\d+)\s+(?<width>\d*\.?\d+)\s+(?<height>\d*\.?\d+)$/
    )
    icons[name] = {
      body: svgMatch[2],
      width: Number(viewBoxMatch?.groups?.width ?? '16'),
      height: Number(viewBoxMatch?.groups?.height ?? '16')
    }
  }
  cached = { prefix: COMFY_ICON_PREFIX, icons }
  return cached
}
