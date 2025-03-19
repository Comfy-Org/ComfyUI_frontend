import { applyTextReplacements } from '@/utils/searchAndReplace'

import { app } from '../../scripts/app'

// Use widget values and dates in output filenames

app.registerExtension({
  name: 'Comfy.SaveImageExtraOutput',
  async beforeRegisterNodeDef(nodeType, nodeData, app) {
    if (
      nodeData.name === 'SaveImage' ||
      nodeData.name === 'SaveAnimatedWEBP' ||
      nodeData.name === 'SaveWEBM'
    ) {
      const onNodeCreated = nodeType.prototype.onNodeCreated
      // When the SaveImage node is created we want to override the serialization of the output name widget to run our S&R
      nodeType.prototype.onNodeCreated = function () {
        const r = onNodeCreated
          ? // @ts-expect-error fixme ts strict error
            onNodeCreated.apply(this, arguments)
          : undefined

        // @ts-expect-error fixme ts strict error
        const widget = this.widgets.find((w) => w.name === 'filename_prefix')
        // @ts-expect-error fixme ts strict error
        widget.serializeValue = () => {
          // @ts-expect-error fixme ts strict error
          return applyTextReplacements(app.graph.nodes, widget.value)
        }

        return r
      }
    } else {
      // When any other node is created add a property to alias the node
      const onNodeCreated = nodeType.prototype.onNodeCreated
      nodeType.prototype.onNodeCreated = function () {
        const r = onNodeCreated
          ? // @ts-expect-error fixme ts strict error
            onNodeCreated.apply(this, arguments)
          : undefined

        if (!this.properties || !('Node name for S&R' in this.properties)) {
          this.addProperty('Node name for S&R', this.constructor.type, 'string')
        }

        return r
      }
    }
  }
})
