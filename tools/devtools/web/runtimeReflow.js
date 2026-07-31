import { app } from '../../scripts/app.js'

// 1x1 transparent PNG so `img.onload` fires deterministically in CI.
const ONE_PIXEL_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

// Emulates the copy-pasted ecosystem idiom where a node is grown at runtime by
// mutating `node.size[1]` directly instead of going through `setSize` (rgthree
// Power Lora Loader, Impact-Pack, N-Nodes, Easy-Use, 0246, mixlab, ...).
function resizeViaDirectSizeMutation(node, height) {
  node.size[1] = height
  node.setDirtyCanvas(true, true)
}

app.registerExtension({
  name: 'DevTools.RuntimeReflow',
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== 'DevToolsNodeRuntimeReflow') return

    const onNodeCreated = nodeType.prototype.onNodeCreated
    nodeType.prototype.onNodeCreated = function () {
      const result = onNodeCreated?.apply(this, arguments)

      this.growByWidget = function () {
        // The widget is incidental to the size mutation under test; it doubles
        // as an example of adding a widget whose identity is not in the schema.
        this.addCustomWidget({
          type: 'custom',
          name: `runtime_widget_${this.widgets?.length ?? 0}`,
          value: 0,
          y: 0
        })
        resizeViaDirectSizeMutation(this, this.size[1] + 80)
      }

      this.growByPreview = function () {
        const img = new Image()
        img.onload = () => {
          this.imgs = [img]
          resizeViaDirectSizeMutation(this, this.size[1] + 120)
        }
        img.src = ONE_PIXEL_PNG
      }

      return result
    }
  }
})
