import { vi } from 'vitest'

import type { resolveNode as realResolveNode } from '../litegraphUtil'

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

export const resolveNode = vi.fn<typeof realResolveNode>(() => undefined)
