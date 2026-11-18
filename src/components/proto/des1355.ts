import { useLocalStorage } from '@vueuse/core'

/** DES-1355 prototype options: where the agent docks while properties is open. */
export interface Des1355Options {
  dock: 'today' | 'inside'
}

export const options = useLocalStorage<Des1355Options>(
  'proto.des1355.options',
  { dock: 'inside' },
  { mergeDefaults: true }
)
