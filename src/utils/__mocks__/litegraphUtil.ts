import { vi } from 'vitest'

import type { resolveNode as realResolveNode } from '@/utils/litegraphUtil'

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
} from '@/utils/litegraphUtil'

export const resolveNode = vi.fn<typeof realResolveNode>(() => undefined)
