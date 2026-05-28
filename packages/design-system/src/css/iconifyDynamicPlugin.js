import { readdirSync, readFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'

import { getDynamicCSSRules } from '@iconify/tailwind4/lib/plugins/dynamic.js'
import plugin from 'tailwindcss/plugin'

const COMFY_ICONS_DIR = resolve(import.meta.dirname, '../icons')
const SCALE = 1.2

function loadComfyIconSet() {
  const icons = {}
  for (const file of readdirSync(COMFY_ICONS_DIR)) {
    if (!file.endsWith('.svg')) continue
    const name = basename(file, '.svg')
    const svg = readFileSync(join(COMFY_ICONS_DIR, file), 'utf8')
    const svgMatch = svg.match(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/i)
    if (!svgMatch) continue
    const viewBox = svgMatch[1].match(/\bviewBox=(['"])(.*?)\1/i)?.[2]
    const viewBoxMatch = viewBox?.match(
      /^(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s+(\d*\.?\d+)\s+(\d*\.?\d+)$/
    )
    icons[name] = {
      body: svgMatch[2],
      width: Number(viewBoxMatch?.[3] ?? '16'),
      height: Number(viewBoxMatch?.[4] ?? '16')
    }
  }
  return { prefix: 'comfy', icons }
}

const options = {
  iconSets: { comfy: loadComfyIconSet() },
  scale: SCALE
}

export default plugin(({ matchComponents }) => {
  matchComponents({
    icon: (icon) => {
      try {
        return getDynamicCSSRules(icon, options)
      } catch {
        return {}
      }
    }
  })
})
