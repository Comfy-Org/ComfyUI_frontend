import { useLayerEditor } from '@/renderer/extensions/layerEditor/composables/useLayerEditor'
import { app } from '@/scripts/app'

app.registerExtension({
  name: 'Comfy.LayerEditor',
  commands: [
    {
      id: 'Comfy.LayerEditor.OpenLayerEditor',
      icon: 'pi pi-images',
      label: 'Open Layer Editor for Selected Node',
      function: () => {
        const selectedNodes = app.canvas.selected_nodes
        if (!selectedNodes || Object.keys(selectedNodes).length !== 1) return

        const selectedNode = selectedNodes[Object.keys(selectedNodes)[0]]
        useLayerEditor().openLayerEditor(selectedNode)
      }
    }
  ]
})
