import { reactive } from 'vue'

import type { CompositorBBox } from '@/renderer/extensions/compositor/composables/compositorLayerState'
import type { ImageFileRef } from '@/renderer/extensions/compositor/composables/compositorPaths'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { createNodeLocatorId } from '@/types/nodeIdentification'
import type { NodeLocatorId } from '@/types/nodeIdentification'
import { isSubgraph } from '@/utils/typeGuardUtil'

type CompositorNodeRef = Pick<LGraphNode, 'id' | 'graph'>

interface CompositorNodeCache {
  layers: ImageFileRef[]
  inputsFingerprint?: string[]
  bboxes?: (CompositorBBox | null)[]
  canvas?: { w: number; h: number }
}

const cacheByNode = reactive(new Map<NodeLocatorId, CompositorNodeCache>())
const previewOverrideByNode = reactive(new Map<NodeLocatorId, string>())

function cacheKey(node: CompositorNodeRef): NodeLocatorId {
  return createNodeLocatorId(
    isSubgraph(node.graph) ? node.graph.id : null,
    node.id
  )
}

export function setCompositorLayers(
  node: CompositorNodeRef,
  refs: ImageFileRef[],
  inputsFingerprint?: string[],
  bboxes?: (CompositorBBox | null)[],
  canvas?: { w: number; h: number }
): void {
  cacheByNode.set(cacheKey(node), {
    layers: refs,
    ...(inputsFingerprint ? { inputsFingerprint } : {}),
    ...(bboxes ? { bboxes } : {}),
    ...(canvas ? { canvas } : {})
  })
}

export function getCompositorLayers(
  node: CompositorNodeRef
): ImageFileRef[] | undefined {
  return cacheByNode.get(cacheKey(node))?.layers
}

export function getCompositorInputsFingerprint(
  node: CompositorNodeRef
): string[] | undefined {
  return cacheByNode.get(cacheKey(node))?.inputsFingerprint
}

export function getCompositorBBoxes(
  node: CompositorNodeRef
): (CompositorBBox | null)[] | undefined {
  return cacheByNode.get(cacheKey(node))?.bboxes
}

export function getCompositorCanvas(
  node: CompositorNodeRef
): { w: number; h: number } | undefined {
  return cacheByNode.get(cacheKey(node))?.canvas
}

export function clearCompositorLayers(node: CompositorNodeRef): void {
  cacheByNode.delete(cacheKey(node))
  clearCompositorPreviewOverride(node)
}

function revokeIfObjectUrl(url: string | undefined): void {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
}

export function setCompositorPreviewOverride(
  node: CompositorNodeRef,
  url: string
): void {
  const key = cacheKey(node)
  revokeIfObjectUrl(previewOverrideByNode.get(key))
  previewOverrideByNode.set(key, url)
}

export function getCompositorPreviewOverride(
  node: CompositorNodeRef
): string | undefined {
  return previewOverrideByNode.get(cacheKey(node))
}

export function clearCompositorPreviewOverride(node: CompositorNodeRef): void {
  const key = cacheKey(node)
  revokeIfObjectUrl(previewOverrideByNode.get(key))
  previewOverrideByNode.delete(key)
}

export function hasCompositorLayers(node: CompositorNodeRef): boolean {
  return (cacheByNode.get(cacheKey(node))?.layers.length ?? 0) > 0
}
