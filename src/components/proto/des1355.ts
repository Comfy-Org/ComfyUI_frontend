/**
 * DES-1355 prototype (agent docked inside the properties panel). Explore
 * code: the tune panel's options. Nothing here is meant to reach main.
 */
import { useLocalStorage } from '@vueuse/core'

export interface Des1355Options {
  /** "today": the agent docks at the window's right edge, full height.
   *  "inside": with the properties panel open, the agent sits between the
   *  canvas and the properties panel, below the run toolbar (Ryan). */
  dock: 'today' | 'inside'
}

export const options = useLocalStorage<Des1355Options>(
  'proto.des1355.options',
  { dock: 'inside' },
  { mergeDefaults: true }
)
