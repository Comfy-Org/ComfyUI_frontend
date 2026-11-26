import type { CompactSize } from '@comfyorg/shared-frontend-utils/geometry'
import type { CompositorBBox } from '@comfyorg/layer-editor/persistence/compositorLayerState'
import type { ImageFileRef } from '@/renderer/extensions/layerEditor/compositor/compositorPaths'
import { resetCompositorStateWidgets } from '@/renderer/extensions/layerEditor/compositor/compositorWidgets'
import {
  clearCompositorLayers,
  clearCompositorPreviewOverride,
  setCompositorLayers
} from '@/renderer/extensions/layerEditor/compositor/useCompositorLayers'
import type { LGraphNode } from '@comfyorg/litegraph/LGraphNode'
import type {
  NodeExecutionOutput,
  NodeOutputWith
} from '@comfyorg/graph-model/nodeOutput'
import type { NodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useApp } from '@/scripts/appInstance'
import type { ComfyExtension } from '@/types/comfy'
import { collectAllNodes } from '@comfyorg/litegraph/utils/graphTraversalUtil'

type ImageCompositorOutput = NodeOutputWith<{
  compositor_layers?: Partial<ImageFileRef>[]
  compositor_inputs?: string[]
  compositor_bboxes?: (CompositorBBox | null)[]
  compositor_canvas?: CompactSize[]
  compositor_state_stale?: boolean[]
}>

function isImageCompositor(node: LGraphNode): boolean {
  return node.constructor.comfyClass === 'ImageCompositor'
}

function applyCompositorLayers(
  node: LGraphNode,
  output: ImageCompositorOutput | undefined
): void {
  const kept = (output?.compositor_layers ?? []).flatMap(
    ({ filename, subfolder = '', type = 'temp' }, index) =>
      filename ? [{ layer: { filename, subfolder, type }, index }] : []
  )
  const layers = kept.map(({ layer }) => layer)
  const rawBboxes = output?.compositor_bboxes
  const bboxes = rawBboxes
    ? kept.map(({ index }) => rawBboxes[index] ?? null)
    : undefined
  setCompositorLayers(
    node,
    layers,
    output?.compositor_inputs,
    bboxes,
    output?.compositor_canvas?.[0]
  )
}

export const imageCompositorExtension: ComfyExtension = {
  name: 'Comfy.ImageCompositor',

  onNodeOutputsUpdated(
    nodeOutputs: Record<NodeLocatorId, NodeExecutionOutput>
  ) {
    const { nodeToNodeLocatorId } = useWorkflowStore()
    for (const node of collectAllNodes(useApp().rootGraph, isImageCompositor)) {
      applyCompositorLayers(node, nodeOutputs[nodeToNodeLocatorId(node)])
    }
  },

  nodeCreated(node: LGraphNode) {
    if (!isImageCompositor(node)) return

    const [oldWidth, oldHeight] = node.size
    node.setSize([Math.max(oldWidth, 300), Math.max(oldHeight, 400)])

    node.hideOutputImages = true

    const onExecuted = node.onExecuted
    node.onExecuted = function (output: ImageCompositorOutput) {
      onExecuted?.call(this, output)

      if (output.compositor_layers?.some((layer) => layer.filename))
        applyCompositorLayers(node, output)
      clearCompositorPreviewOverride(node)

      if (output.compositor_state_stale?.[0]) {
        resetCompositorStateWidgets(node)
        node.graph?.setDirtyCanvas(true)
      }
    }

    const onRemoved = node.onRemoved
    node.onRemoved = function () {
      onRemoved?.call(this)
      clearCompositorLayers(node)
    }
  }
}
