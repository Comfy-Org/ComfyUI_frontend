import type { CompositorBBox } from '@/renderer/extensions/compositor/composables/compositorLayerState'
import { resetCompositorStateWidgets } from '@/renderer/extensions/compositor/composables/compositorWidgets'
import {
  clearCompositorLayers,
  clearCompositorPreviewOverride,
  setCompositorLayers
} from '@/renderer/extensions/compositor/composables/useCompositorLayers'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { NodeOutputWith } from '@/schemas/apiSchema'
import { useExtensionService } from '@/services/extensionService'

type ImageCompositorOutput = NodeOutputWith<{
  compositor_layers?: Record<string, string>[]
  compositor_inputs?: string[]
  compositor_bboxes?: (CompositorBBox | null)[]
  compositor_canvas?: { w: number; h: number }[]
  compositor_state_stale?: boolean[]
}>

useExtensionService().registerExtension({
  name: 'Comfy.ImageCompositor',

  nodeCreated(node: LGraphNode) {
    if (node.constructor.comfyClass !== 'ImageCompositor') return

    const [oldWidth, oldHeight] = node.size
    node.setSize([Math.max(oldWidth, 300), Math.max(oldHeight, 400)])

    node.hideOutputImages = true

    const onExecuted = node.onExecuted
    node.onExecuted = function (output: ImageCompositorOutput) {
      onExecuted?.call(this, output)

      const kept = (output.compositor_layers ?? [])
        .map((layer, index) => [layer, index] as const)
        .filter(([layer]) => layer?.filename)
      const layers = kept.map(([layer]) => ({
        filename: layer.filename,
        subfolder: layer.subfolder ?? '',
        type: layer.type ?? 'temp'
      }))
      const rawBboxes = output.compositor_bboxes
      const bboxes = rawBboxes
        ? kept.map(([, index]) => rawBboxes[index] ?? null)
        : undefined
      if (layers.length)
        setCompositorLayers(
          node,
          layers,
          output.compositor_inputs,
          bboxes,
          output.compositor_canvas?.[0]
        )
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
})
