import {
  addTextPreviewWidgets,
  updateTextPreviewWidgets
} from '@/extensions/core/textPreviewWidgets'
import type { ComfyExtension } from '@/types/comfy'

export const saveTextExtension: ComfyExtension = {
  name: 'Comfy.saveText',
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== 'SaveText') return

    const onNodeCreated = nodeType.prototype.onNodeCreated
    nodeType.prototype.onNodeCreated = function () {
      onNodeCreated?.apply(this, [])
      addTextPreviewWidgets(this)
    }

    const onExecuted = nodeType.prototype.onExecuted
    nodeType.prototype.onExecuted = function (message) {
      onExecuted?.apply(this, [message])
      updateTextPreviewWidgets(this, message)
    }
  }
}
