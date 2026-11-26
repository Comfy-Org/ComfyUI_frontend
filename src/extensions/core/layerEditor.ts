import { useApp } from '@/scripts/appInstance'
import { selectedCanvasNodes } from '@/renderer/core/canvas/litegraph/selectionAdapter'
import type { ComfyExtension } from '@/types/comfy'

export const layerEditorExtension: ComfyExtension = {
  name: 'Comfy.LayerEditor',
  commands: [
    {
      id: 'Comfy.LayerEditor.OpenLayerEditor',
      icon: 'icon-[lucide--images]',
      label: 'Open Layer Editor for Selected Node',
      function: async () => {
        const selectedNodes = selectedCanvasNodes(useApp().canvas)
        if (selectedNodes.length !== 1) return

        const [selectedNode] = selectedNodes
        const { useLayerEditor } =
          await import('@/renderer/extensions/layerEditor/composables/useLayerEditor')
        useLayerEditor().openLayerEditor(selectedNode)
      }
    }
  ]
}
