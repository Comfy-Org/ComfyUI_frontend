/**
 * DynamicPrompts — rewritten with the v2 extension API.
 *
 * v1: reads node.widgets, assigns widget.serializeValue
 * v2: same logic, uses WidgetHandle instead of raw widget
 */

import { defineNodeExtension } from '@/services/extensionV2Service'
import { processDynamicPrompt } from '@/utils/formatUtil'

defineNodeExtension({
  name: 'Comfy.DynamicPrompts.V2',

  nodeCreated(node) {
    for (const widget of node.widgets()) {
      if (widget.getOptions().dynamicPrompts) {
        widget.setSerializeValue((_workflowNode, _widgetIndex) => {
          const value = widget.getValue<string>()
          return typeof value === 'string'
            ? processDynamicPrompt(value)
            : value
        })
      }
    }
  }
})
