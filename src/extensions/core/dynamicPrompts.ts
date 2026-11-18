import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { bindDynamicPromptSerializer } from '@/core/graph/widgets/dynamicPromptSerializer'
import type { ComfyExtension } from '@/types/comfy'

export const dynamicPromptsExtension: ComfyExtension = {
  name: 'Comfy.DynamicPrompts',
  nodeCreated(node: LGraphNode) {
    if (node.widgets) {
      const widgets = node.widgets.filter((w) => w.dynamicPrompts)
      for (const widget of widgets) {
        bindDynamicPromptSerializer(widget)
      }
    }
  }
}
