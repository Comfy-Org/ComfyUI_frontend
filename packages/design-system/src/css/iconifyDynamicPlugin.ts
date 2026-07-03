import { loadIconSet } from '@iconify/tailwind4/lib/helpers/loader.js'
import { getDynamicCSSRules } from '@iconify/tailwind4/lib/plugins/dynamic.js'
import { getIconsCSSData } from '@iconify/utils/lib/css/icons'
import { matchIconName } from '@iconify/utils/lib/icon/name'
import plugin from 'tailwindcss/plugin'

import { COMFY_ICON_PREFIX, loadComfyIconSet } from './comfyIconSet.js'

const SCALE = 1.2

const options = {
  iconSets: { [COMFY_ICON_PREFIX]: loadComfyIconSet() },
  scale: SCALE
}

function getModeCSSRules(icon: string, mode: 'mask' | 'background') {
  const nameParts = icon.split(/--|:/)
  if (nameParts.length !== 2) return {}

  const [prefix, name] = nameParts
  if (!(prefix.match(matchIconName) && name.match(matchIconName))) return {}

  const iconSet =
    prefix === COMFY_ICON_PREFIX ? loadComfyIconSet() : loadIconSet(prefix)
  if (!iconSet) return {}

  const generated = getIconsCSSData(iconSet, [name], {
    iconSelector: '.icon',
    mode
  })
  if (generated.css.length !== 1) return {}

  const size = { width: `${SCALE}em`, height: `${SCALE}em` }
  return { ...generated.common?.rules, ...size, ...generated.css[0].rules }
}

export default plugin(({ matchComponents }) => {
  matchComponents({
    icon: (icon) => {
      try {
        return getDynamicCSSRules(icon, options)
      } catch {
        return {}
      }
    },
    'icon-img': (icon) => getModeCSSRules(icon, 'background'),
    'icon-mask': (icon) => getModeCSSRules(icon, 'mask')
  })
})
