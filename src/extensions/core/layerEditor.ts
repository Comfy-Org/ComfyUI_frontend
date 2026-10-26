import { app } from '@/scripts/app'
import { selectedCanvasNodes } from '@/renderer/core/canvas/litegraph/selectionAdapter'
import type { ComfyExtension } from '@/types/comfy'

export const layerEditorExtension: ComfyExtension = {
  name: 'Comfy.LayerEditor',
  commands: [
    {
      id: 'Comfy.LayerEditor.OpenLayerEditor',
      icon: 'pi pi-images',
      label: 'Open Layer Editor for Selected Node',
      function: async () => {
        const selectedNodes = selectedCanvasNodes(app.canvas)
        if (selectedNodes.length !== 1) return

        const [selectedNode] = selectedNodes
        const { useLayerEditor } =
          await import('@/renderer/extensions/layerEditor/composables/useLayerEditor')
        useLayerEditor().openLayerEditor(selectedNode)
      }
    }
  ]
}
