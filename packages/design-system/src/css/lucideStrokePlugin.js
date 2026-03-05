import plugin from 'tailwindcss/plugin'
import { getIconsCSSData } from '@iconify/utils/lib/css/icons'
import { loadIconSet } from '@iconify/tailwind4/lib/helpers/loader.js'
import { matchIconName } from '@iconify/utils/lib/icon/name'

/**
 * Tailwind 4 plugin that provides lucide icon variants with configurable
 * stroke-width via class prefix.
 *
 * Usage in CSS:
 *   @plugin "./lucideStrokePlugin.js";
 *
 * Usage in templates:
 *   <i class="icon-s1-[lucide--settings]" />     <!-- stroke-width: 1 -->
 *   <i class="icon-s1.5-[lucide--settings]" />   <!-- stroke-width: 1.5 -->
 *   <i class="icon-s2.5-[lucide--settings]" />   <!-- stroke-width: 2.5 -->
 *
 * The default class remains stroke-width: 2.
 */

const STROKE_WIDTHS = ['1', '1.3', '1.5', '2', '2.5']

const SCALE = 1.2

function getDynamicCSSRulesWithStroke(icon, strokeWidth) {
  const nameParts = icon.split(/--|:/)
  if (nameParts.length !== 2) {
    throw new Error(`Invalid icon name: "${icon}"`)
  }
  const [prefix, name] = nameParts
  if (!(prefix.match(matchIconName) && name.match(matchIconName))) {
    throw new Error(`Invalid icon name: "${icon}"`)
  }
  const iconSet = loadIconSet(prefix)
  if (!iconSet) {
    throw new Error(
      `Cannot load icon set for "${prefix}". Install "@iconify-json/${prefix}" as dev dependency?`
    )
  }
  const generated = getIconsCSSData(iconSet, [name], {
    iconSelector: '.icon',
    customise: (content) =>
      content.replaceAll('stroke-width="2"', `stroke-width="${strokeWidth}"`)
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
          console.warn(err.message)
          return {}
        }
      }
    })
  }
})
