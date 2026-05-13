/**
 * DynamicPrompts — rewritten with the v2 extension API.
 *
 * v1: reads node.widgets, assigns widget.serializeValue
 * v2: same logic, uses WidgetHandle instead of raw widget
 */

import {
  defineNode,
  type NodeHandle,
  type WidgetBeforeSerializeEvent
} from '@/extension-api'
import { processDynamicPrompt } from '@/utils/formatUtil'

defineNode({
  name: 'Comfy.DynamicPrompts.V2',

  nodeCreated(node: NodeHandle) {
    for (const widget of node.getWidgets()) {
      if (widget.getOption('dynamicPrompts')) {
        widget.on('beforeSerialize', (e: WidgetBeforeSerializeEvent) => {
          if (e.context === 'prompt') {
            const value = widget.getValue()
            e.setSerializedValue(
              typeof value === 'string' ? processDynamicPrompt(value) : value
            )
          }
        })
      }
    }
  }
})
