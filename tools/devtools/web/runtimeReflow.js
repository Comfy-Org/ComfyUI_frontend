//es
// eslint-disable-next-line import-x/no-unresolved -- import is correct at time of test execution
import { app } from '../../scripts/app.js'

// 1x1 transparent PNG so `img.onload` fires deterministically in CI.
const ONE_PX_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

// Emulates the two runtime node-growth idioms that grow a node by mutating
// `node.size[1]` directly. The LGraphNode `size` Proxy now commits these element
// mutations to the layout store, so Vue nodes reflow without a manual resize:
//  1. WIDGET-COUNT growth  — rgthree Power Lora Loader, Easy-Use, 0246, n-nodes,
//     mixlab, advanced-latent-control: addCustomWidget(...) then `size[1] = ...`.
//  2. IMAGE-PREVIEW growth — Impact-Pack, n-nodes: on `img.onload` set
//     `node.imgs` and `size[1] = Math.max(200, ...)` with NO widget added.
app.registerExtension({
  name: 'DevTools.RuntimeReflow',
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== 'DevToolsNodeRuntimeReflow') return

    const onNodeCreated = nodeType.prototype.onNodeCreated
    nodeType.prototype.onNodeCreated = function () {
      const result = onNodeCreated?.apply(this, arguments)

      this.growByWidget = function () {
        this.addCustomWidget({
          type: 'custom',
          name: `runtime_widget_${this.widgets?.length ?? 0}`,
          value: 0,
          y: 0
        })
        this.size[1] = this.size[1] + 80
        this.setDirtyCanvas(true, true)
      }

      this.growByPreview = function () {
        // eslint-disable-next-line no-undef -- Image is a browser global; this file runs only in the browser
        const img = new Image()
        img.onload = () => {
          this.imgs = [img]
          this.size[1] = Math.max(this.size[1] + 120, 200)
          this.setDirtyCanvas(true, true)
        }
        img.src = ONE_PX_PNG
      }

      return result
    }
  }
})
