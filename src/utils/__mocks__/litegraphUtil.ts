import { vi } from 'vitest'

import type {
  createNode as realCreateNode,
  resolveNode as realResolveNode
} from '../litegraphUtil'

export {
  addToComboValues,
  compressWidgetInputSlots,
  executeWidgetsCallback,
  getItemsColorOption,
  getLinkTypeColor,
  getWidgetIdForNode,
  isAnimatedOutput,
  isAudioNode,
  isImageNode,
  isLGraphGroup,
  isLGraphNode,
  isLoad3dNode,
  isSelectOnly,
  isVideoNode,
  isVideoOutput,
  mapLiveWidgetsById,
  migrateWidgetsValues,
  resolveComboValues,
  resolveNodeWidget
} from '../litegraphUtil'

export const createNode = vi.fn<typeof realCreateNode>(async () => null)
export const resolveNode = vi.fn<typeof realResolveNode>(() => undefined)
