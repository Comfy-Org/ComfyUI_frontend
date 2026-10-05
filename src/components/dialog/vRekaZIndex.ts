import type { Directive } from 'vue'

import { raiseModalLayer, releaseModalLayer } from '@/utils/modalLayerStack'

export const vRekaZIndex: Directive<HTMLElement> = {
  mounted(el) {
    raiseModalLayer(el)
  },
  updated(el, { value, oldValue }) {
    if (value === oldValue) return
    raiseModalLayer(el)
  },
  beforeUnmount(el) {
    releaseModalLayer(el)
  }
}
