import { useLocalStorage } from '@vueuse/core'

/** DES-1355 prototype options, switched from the tune panel. */
export interface Des1355Options {
  dock: 'today' | 'inside'
  agentTop: 'full-height' | 'under-run'
}

export const options = useLocalStorage<Des1355Options>(
  'proto.des1355.options.v2',
  { dock: 'inside', agentTop: 'full-height' },
  { mergeDefaults: true }
)
