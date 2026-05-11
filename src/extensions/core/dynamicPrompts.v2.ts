/**
 * DynamicPrompts — rewritten with the v2 extension API.
 *
 * v1: reads node.widgets, assigns widget.serializeValue
 * v2: same logic, uses WidgetHandle instead of raw widget
 */

import { defineNodeExtension } from '@/extension-api'
import { processDynamicPrompt } from '@/utils/formatUtil'

defineNodeExtension({
  name: 'Comfy.DynamicPrompts.V2',

  nodeCreated(node) {
    for (const widget of node.widgets()) {
      if (widget.getOption('dynamicPrompts')) {
        widget.on('beforeSerialize', (e) => {
          if (e.context === 'prompt') {
            const value = widget.getValue() as string
            e.setSerializedValue(
              typeof value === 'string' ? processDynamicPrompt(value) : value
            )
          }
        })
      }
    }
  }
})
