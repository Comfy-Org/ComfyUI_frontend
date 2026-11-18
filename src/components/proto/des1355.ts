import { useLocalStorage } from '@vueuse/core'

/** DES-1355 prototype options, switched from the tune panel. */
export interface Des1355Options {
  dock: 'today' | 'inside'
  maximize: 'today' | 'overlay'
  overlayCheck: 'today' | 'include-properties'
  issuesCard: 'today' | 'shift-left' | 'below-header'
}

export const options = useLocalStorage<Des1355Options>(
  'proto.des1355.options',
  {
    dock: 'inside',
    maximize: 'today',
    overlayCheck: 'today',
    issuesCard: 'today'
  },
  { mergeDefaults: true }
)

/** The narrowest canvas before the agent floats over it instead of docking. */
export const MIN_CANVAS_WIDTH = 360

/** How far the issues card drops to clear the agent's header (option "below-header"). */
export const AGENT_HEADER_HEIGHT = 56
