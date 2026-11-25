import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { processDynamicPrompt } from '@/utils/formatUtil'
import type { ComfyExtension } from '@/types/comfy'

// Allows for simple dynamic prompt replacement
// Inputs in the format {a|b} will have a random value of a or b chosen when the prompt is queued.

export const dynamicPromptsExtension: ComfyExtension = {
  name: 'Comfy.DynamicPrompts',
  nodeCreated(node: LGraphNode) {
    if (node.widgets) {
      const widgets = node.widgets.filter((w) => w.dynamicPrompts)
      for (const widget of widgets) {
        widget.serializeValue = () => {
          if (typeof widget.value !== 'string') return widget.value

          return processDynamicPrompt(widget.value)
        }
      }
    }
  }
}
