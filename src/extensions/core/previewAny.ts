/*
Preview Any - original implement from
https://github.com/rgthree/rgthree-comfy/blob/main/py/display_any.py
upstream requested in https://github.com/Kosinkadink/rfcs/blob/main/rfcs/0000-corenodes.md#preview-nodes
 */
import { app } from '@/scripts/app'
import { DOMWidget } from '@/scripts/domWidget'
import { ComfyWidgets } from '@/scripts/widgets'
import { useExtensionService } from '@/services/extensionService'

useExtensionService().registerExtension({
  name: 'Comfy.PreviewAny',
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name === 'PreviewAny') {
      const onNodeCreated = nodeType.prototype.onNodeCreated

      nodeType.prototype.onNodeCreated = function () {
        onNodeCreated ? onNodeCreated.apply(this, []) : undefined

        const showValueWidget = ComfyWidgets['STRING'](
          this,
          'preview',
          ['STRING', { multiline: true }],
          app
        ).widget as DOMWidget<any, any>

        showValueWidget.element.readOnly = true

        showValueWidget.serialize = false
      }

      const onExecuted = nodeType.prototype.onExecuted

      nodeType.prototype.onExecuted = function (message) {
        onExecuted === null || onExecuted === void 0
          ? void 0
          : onExecuted.apply(this, [message])

        const previewWidget = this.widgets?.find((w) => w.name === 'preview')

        if (previewWidget) {
          previewWidget.value = message.text[0]
        }
      }
    }
  }
})
