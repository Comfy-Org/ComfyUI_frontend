import { reactive } from 'vue'

import type { CompositorBBox } from '@/composables/compositor/compositorLayerState'
import type { ImageFileRef } from '@/composables/compositor/compositorPaths'
import type { NodeId } from '@/types/nodeId'

interface CompositorNodeCache {
  layers: ImageFileRef[]
  inputsFingerprint?: string[]
  bboxes?: (CompositorBBox | null)[]
}

const cacheByNode = reactive(new Map<NodeId, CompositorNodeCache>())
const previewOverrideByNode = reactive(new Map<NodeId, string>())

export function setCompositorLayers(
  nodeId: NodeId,
  refs: ImageFileRef[],
  inputsFingerprint?: string[],
  bboxes?: (CompositorBBox | null)[]
): void {
  cacheByNode.set(nodeId, {
    layers: refs,
    ...(inputsFingerprint ? { inputsFingerprint } : {}),
    ...(bboxes ? { bboxes } : {})
  })
}

export function getCompositorLayers(
  nodeId: NodeId
): ImageFileRef[] | undefined {
  return cacheByNode.get(nodeId)?.layers
}

export function getCompositorInputsFingerprint(
  nodeId: NodeId
): string[] | undefined {
  return cacheByNode.get(nodeId)?.inputsFingerprint
}

export function getCompositorBBoxes(
  nodeId: NodeId
): (CompositorBBox | null)[] | undefined {
  return cacheByNode.get(nodeId)?.bboxes
}

export function clearCompositorLayers(nodeId: NodeId): void {
  cacheByNode.delete(nodeId)
  clearCompositorPreviewOverride(nodeId)
}

function revokeIfObjectUrl(url: string | undefined): void {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
}

export function setCompositorPreviewOverride(
  nodeId: NodeId,
  url: string
): void {
  revokeIfObjectUrl(previewOverrideByNode.get(nodeId))
  previewOverrideByNode.set(nodeId, url)
}

export function getCompositorPreviewOverride(
  nodeId: NodeId
): string | undefined {
  return previewOverrideByNode.get(nodeId)
}

export function clearCompositorPreviewOverride(nodeId: NodeId): void {
  revokeIfObjectUrl(previewOverrideByNode.get(nodeId))
  previewOverrideByNode.delete(nodeId)
}

export function hasCompositorLayers(nodeId: NodeId): boolean {
  return (cacheByNode.get(nodeId)?.layers.length ?? 0) > 0
}
