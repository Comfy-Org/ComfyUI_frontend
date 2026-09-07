import { getIconsCSSData } from '@iconify/utils/lib/css/icons'
import { matchIconName } from '@iconify/utils/lib/icon/name'
import { loadIconSet } from '@iconify/tailwind4/lib/helpers/loader.js'
import plugin from 'tailwindcss/plugin'

import { COMFY_ICON_PREFIX, loadComfyIconSet } from './comfyIconSet.js'

/**
 * Tailwind 4 plugin that provides icon variants with configurable
 * stroke-width via class prefix. Supports lucide and comfy icon sets.
 *
 * Usage in CSS:
 *   @plugin "./lucideStrokePlugin.js";
 *
 * Usage in templates:
 *   <i class="icon-s1-[lucide--settings]" />     <!-- stroke-width: 1 -->
 *   <i class="icon-s1.5-[lucide--settings]" />   <!-- stroke-width: 1.5 -->
 *   <i class="icon-s2.5-[comfy--workflow]" />    <!-- stroke-width: 2.5 -->
 *
 * The plain `icon-[...]` class keeps each icon's native stroke-width.
 */

const STROKE_WIDTHS = ['1', '1.3', '1.5', '2', '2.5']

const LUCIDE_PREFIX = 'lucide'
const SUPPORTED_PREFIXES = new Set([LUCIDE_PREFIX, COMFY_ICON_PREFIX])

const SCALE = 1.2

const STROKE_WIDTH_ATTR_RE = /stroke-width="[^"]*"/g

class InvalidIconProbeError extends Error {}

function resolveIconSet(prefix) {
  if (prefix === COMFY_ICON_PREFIX) return loadComfyIconSet()
  return loadIconSet(prefix)
}

function getDynamicCSSRulesWithStroke(icon, strokeWidth) {
  const nameParts = icon.split(/--|:/)
  if (nameParts.length !== 2) {
    throw new InvalidIconProbeError(`Invalid icon name: "${icon}"`)
  }
  const [prefix, name] = nameParts
  if (!SUPPORTED_PREFIXES.has(prefix)) {
    throw new InvalidIconProbeError(`Unsupported icon prefix: "${prefix}"`)
  }
  if (!(prefix.match(matchIconName) && name.match(matchIconName))) {
    throw new InvalidIconProbeError(`Invalid icon name: "${icon}"`)
  }
  const iconSet = resolveIconSet(prefix)
  if (!iconSet) {
    throw new Error(
      `Cannot load icon set for "${prefix}". Install "@iconify-json/${prefix}" as dev dependency?`
    )
  }
  const generated = getIconsCSSData(iconSet, [name], {
    iconSelector: '.icon',
    customise: (content) =>
      content.replace(STROKE_WIDTH_ATTR_RE, `stroke-width="${strokeWidth}"`)
  })
  if (generated.css.length !== 1) {
    throw new Error(`Cannot find "${icon}". Bad icon name?`)
  }
  if (SCALE && generated.common?.rules) {
    generated.common.rules.height = SCALE + 'em'
    generated.common.rules.width = SCALE + 'em'
  }
  return {
    ...generated.common?.rules,
    ...generated.css[0].rules
  }
}

export default plugin(({ matchComponents }) => {
  for (const sw of STROKE_WIDTHS) {
    matchComponents({
      [`icon-s${sw}`]: (icon) => {
        try {
          return getDynamicCSSRulesWithStroke(icon, sw)
        } catch (err) {
          if (err instanceof InvalidIconProbeError) return {}
          throw err
        }
      }
    })
  }
})
