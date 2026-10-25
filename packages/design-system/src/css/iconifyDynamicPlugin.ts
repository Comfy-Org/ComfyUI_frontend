import { loadIconSet } from '@iconify/tailwind4/lib/helpers/loader.js'
import { getDynamicCSSRules } from '@iconify/tailwind4/lib/plugins/dynamic.js'
import { getIconsCSSData } from '@iconify/utils/lib/css/icons'
import { matchIconName } from '@iconify/utils/lib/icon/name'
import plugin from 'tailwindcss/plugin'

import { COMFY_ICON_PREFIX, loadComfyIconSet } from './comfyIconSet.js'

const SIZE = 'calc(var(--spacing) * 4)'

const options = {
  iconSets: { [COMFY_ICON_PREFIX]: loadComfyIconSet() },
  scale: 0
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

  const size = { width: SIZE, height: SIZE }
  return { ...generated.common?.rules, ...generated.css[0].rules, ...size }
}

export default plugin(({ matchComponents }) => {
  matchComponents({
    icon: (icon) => {
      try {
        return {
          ...getDynamicCSSRules(icon, options),
          width: SIZE,
          height: SIZE
        }
      } catch {
        return {}
      }
    },
    'icon-img': (icon) => getModeCSSRules(icon, 'background'),
    'icon-mask': (icon) => getModeCSSRules(icon, 'mask')
  })
})
