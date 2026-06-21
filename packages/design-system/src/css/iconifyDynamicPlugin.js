import { getDynamicCSSRules } from '@iconify/tailwind4/lib/plugins/dynamic.js'
import plugin from 'tailwindcss/plugin'

import { COMFY_ICON_PREFIX, loadComfyIconSet } from './comfyIconSet.js'

const SCALE = 1.2

const options = {
  iconSets: { [COMFY_ICON_PREFIX]: loadComfyIconSet() },
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
