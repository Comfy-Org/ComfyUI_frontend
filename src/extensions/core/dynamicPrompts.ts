import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useExtensionService } from '@/services/extensionService'
import { processDynamicPrompt } from '@/utils/formatUtil'

// Allows for simple dynamic prompt replacement
// Inputs in the format {a|b} will have a random value of a or b chosen when the prompt is queued.

useExtensionService().registerExtension({
  name: 'Comfy.DynamicPrompts',
  nodeCreated(node: LGraphNode) {
    if (node.widgets) {
      // Locate dynamic prompt text widgets
      // Include any widgets with dynamicPrompts set to true, and customtext
      const widgets = node.widgets.filter((w) => w.dynamicPrompts)
      for (const widget of widgets) {
        // Override the serialization of the value to resolve dynamic prompts for all widgets supporting it in this node
        widget.serializeValue = () => {
          if (typeof widget.value !== 'string') return widget.value

          return processDynamicPrompt(widget.value)
        }
      }
    }
  }
})
