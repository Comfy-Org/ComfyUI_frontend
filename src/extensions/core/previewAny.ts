/*
Preview Any - original implement from
https://github.com/rgthree/rgthree-comfy/blob/main/py/display_any.py
upstream requested in https://github.com/Kosinkadink/rfcs/blob/main/rfcs/0000-corenodes.md#preview-nodes
 */
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { app } from '@/scripts/app'
import { type DOMWidget } from '@/scripts/domWidget'
import { ComfyWidgets } from '@/scripts/widgets'
import { useExtensionService } from '@/services/extensionService'

useExtensionService().registerExtension({
  name: 'Comfy.PreviewAny',
  async beforeRegisterNodeDef(
    nodeType: typeof LGraphNode,
    nodeData: ComfyNodeDef
  ) {
    if (nodeData.name === 'PreviewAny') {
      const onNodeCreated = nodeType.prototype.onNodeCreated

      nodeType.prototype.onNodeCreated = function () {
        onNodeCreated ? onNodeCreated.apply(this, []) : undefined

        const showValueWidget = ComfyWidgets['MARKDOWN'](
          this,
          'preview_markdown',
          ['MARKDOWN', {}],
          app
        ).widget as DOMWidget<HTMLTextAreaElement, string>

        const showValueWidgetPlain = ComfyWidgets['STRING'](
          this,
          'preview_text',
          ['STRING', { multiline: true }],
          app
        ).widget as DOMWidget<HTMLTextAreaElement, string>

        const showAsPlaintextWidget = ComfyWidgets['BOOLEAN'](
          this,
          'previewMode',
          [
            'BOOLEAN',
            { label_on: 'Markdown', label_off: 'Plaintext', default: false }
          ],
          app
        )

        showAsPlaintextWidget.widget.callback = (value: boolean) => {
          showValueWidget.hidden = !value
          showValueWidget.options.hidden = !value
          showValueWidgetPlain.hidden = value
          showValueWidgetPlain.options.hidden = value
        }

        showValueWidget.label = 'Preview'
        showValueWidget.hidden = true
        showValueWidget.options.hidden = true
        showValueWidget.options.read_only = true
        showValueWidget.options.serialize = false
        showValueWidget.element.readOnly = true
        showValueWidget.serialize = false

        showValueWidgetPlain.label = 'Preview'
        showValueWidgetPlain.hidden = false
        showValueWidgetPlain.options.hidden = false
        showValueWidgetPlain.options.read_only = true
        showValueWidgetPlain.options.serialize = false
        showValueWidgetPlain.element.readOnly = true
        showValueWidgetPlain.serialize = false

        // The previewMode toggle is a frontend-only display preference and
        // is not declared in the backend INPUT_TYPES, so it must not be
        // serialized into the API prompt (would alter the cache signature).
        showAsPlaintextWidget.widget.options.serialize = false
      }

      const onExecuted = nodeType.prototype.onExecuted

      nodeType.prototype.onExecuted = function (message) {
        onExecuted === null || onExecuted === void 0
          ? void 0
          : onExecuted.apply(this, [message])

        const previewWidgets =
          this.widgets?.filter((w) => w.name.startsWith('preview_')) ?? []

        for (const previewWidget of previewWidgets) {
          const text = message.text ?? ''
          previewWidget.value = Array.isArray(text)
            ? (text?.join('\n\n') ?? '')
            : text
        }
      }
    }
  }
})
