import { app } from '@/scripts/app'
import { ComfyWidgets } from '@/scripts/widgets'
import { useExtensionService } from '@/services/extensionService'

useExtensionService().registerExtension({
  name: 'Comfy.SaveTextPreview',
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== 'SaveText') return

    const onNodeCreated = nodeType.prototype.onNodeCreated
    nodeType.prototype.onNodeCreated = function () {
      onNodeCreated?.apply(this, [])

      const previewWidget = ComfyWidgets['STRING'](
        this,
        'preview_text',
        ['STRING', { multiline: true }],
        app
      ).widget

      previewWidget.label = 'Preview'
      previewWidget.hidden = false
      previewWidget.options.hidden = false
      previewWidget.options.read_only = true
      previewWidget.options.serialize = false
      previewWidget.serialize = false
    }

    const onExecuted = nodeType.prototype.onExecuted
    nodeType.prototype.onExecuted = function (message) {
      onExecuted?.apply(this, [message])

      const text = message?.text ?? ''
      const preview = this.widgets?.find((w) => w.name === 'preview_text')
      if (preview) {
        preview.value = Array.isArray(text) ? text.join('\n\n') : text
      }
    }
  }
})
