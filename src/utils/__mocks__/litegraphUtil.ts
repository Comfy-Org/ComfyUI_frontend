import { vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LGraphGroup } from '@/lib/litegraph/src/LGraphGroup'

import type * as real from '../litegraphUtil'

export const createNode = vi.fn<typeof real.createNode>(async () => null)
export const isImageNode: typeof real.isImageNode = (
  node
): node is LGraphNode & {
  imgs: HTMLImageElement[] | undefined
} =>
  !!node &&
  (node.previewMediaType === 'image' ||
    (node.previewMediaType !== 'video' && !!node.imgs?.length))
export const isVideoNode: typeof real.isVideoNode = (
  node
): node is LGraphNode & {
  videoContainer: HTMLElement | undefined
  imgs: HTMLVideoElement[] | undefined
} => !!node && (node.previewMediaType === 'video' || !!node.videoContainer)
export const isLGraphNode: typeof real.isLGraphNode = (
  item
): item is LGraphNode => item instanceof LGraphNode
export const isLGraphGroup: typeof real.isLGraphGroup = (
  item
): item is LGraphGroup => item instanceof LGraphGroup
export const isAnimatedOutput = vi.fn<typeof real.isAnimatedOutput>(() => false)
export const isVideoOutput = vi.fn<typeof real.isVideoOutput>(() => false)
export const isAudioNode = vi.fn<typeof real.isAudioNode>(() => false)
export const resolveComboValues = vi.fn<typeof real.resolveComboValues>(
  () => []
)
export const addToComboValues = vi.fn<typeof real.addToComboValues>()
export const isSelectOnly = vi.fn<typeof real.isSelectOnly>(() => false)
export const getItemsColorOption = vi.fn<typeof real.getItemsColorOption>(
  () => null
)
export const executeWidgetsCallback =
  vi.fn<typeof real.executeWidgetsCallback>()
export const migrateWidgetsValues: typeof real.migrateWidgetsValues = (
  _inputDefs,
  _widgets,
  values
) => values
export const compressWidgetInputSlots =
  vi.fn<typeof real.compressWidgetInputSlots>()
export const getLinkTypeColor = vi.fn<typeof real.getLinkTypeColor>(
  () => '#999'
)
export const resolveNode = vi.fn<typeof real.resolveNode>(() => undefined)
export const resolveNodeWidget = vi.fn<typeof real.resolveNodeWidget>(() => [])
export const getWidgetIdForNode = vi.fn<typeof real.getWidgetIdForNode>(
  () => undefined
)
export const mapLiveWidgetsById = vi.fn<typeof real.mapLiveWidgetsById>(
  () => new Map()
)
export const isLoad3dNode = vi.fn<typeof real.isLoad3dNode>(() => false)
