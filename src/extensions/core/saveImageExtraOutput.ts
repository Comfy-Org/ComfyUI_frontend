import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { applyTextReplacements } from '@/utils/searchAndReplace'

import { app } from '../../scripts/app'

const saveNodeTypes = new Set([
  'SaveImage',
  'SaveVideo',
  'SaveAnimatedWEBP',
  'SaveWEBM',
  'SaveAudio',
  'SaveGLB',
  'SaveAnimatedPNG',
  'CLIPSave',
  'VAESave',
  'ModelSave',
  'LoraSave',
  'SaveLatent'
])

// Use widget values and dates in output filenames

app.registerExtension({
  name: 'Comfy.SaveImageExtraOutput',
  async beforeRegisterNodeDef(nodeType, nodeData, app) {
    if (saveNodeTypes.has(nodeData.name)) {
      const onNodeCreated = nodeType.prototype.onNodeCreated
      // When the SaveImage node is created we want to override the serialization of the output name widget to run our S&R
      nodeType.prototype.onNodeCreated = function (this: LGraphNode) {
        const r = onNodeCreated?.call(this)

        const widget = this.widgets?.find((w) => w.name === 'filename_prefix')
        if (widget) {
          widget.serializeValue = () => {
            const value = typeof widget.value === 'string' ? widget.value : ''
            return applyTextReplacements(app.rootGraph, value)
          }
        }

        return r
      }
    } else {
      // When any other node is created add a property to alias the node
      const onNodeCreated = nodeType.prototype.onNodeCreated
      nodeType.prototype.onNodeCreated = function (this: LGraphNode) {
        const r = onNodeCreated?.call(this)

        if (!this.properties || !('Node name for S&R' in this.properties)) {
          this.addProperty('Node name for S&R', this.constructor.type, 'string')
        }

        return r
      }
    }
  }
})
