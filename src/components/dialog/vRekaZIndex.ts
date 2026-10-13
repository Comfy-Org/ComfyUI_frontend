import type { Directive } from 'vue'

import { raiseModalLayer, releaseModalLayer } from '@/utils/modalLayerStack'

export const vRekaZIndex: Directive<HTMLElement> = {
  mounted: raiseModalLayer,
  beforeUnmount: releaseModalLayer
}
