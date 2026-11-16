import { watch } from 'vue'

import { toPreviewText } from '@/extensions/core/textPreviewWidgets'
import { useApp } from '@/scripts/appInstance'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'

export function useTextPreviewSystem(): void {
  const domWidgets = useDomWidgetStore()
  const outputs = useNodeOutputStore()
  const app = useApp()

  watch(
    () => {
      const rootGraph = app.rootGraphOrUndefined
      return [...domWidgets.widgetStates.values()].flatMap(({ widget }) => {
        const node = widget.node
        if (
          !rootGraph ||
          node.graph?.rootGraph !== rootGraph ||
          widget.type !== 'textPreview' ||
          (node.comfyClass !== 'PreviewAny' && node.comfyClass !== 'SaveText')
        )
          return []

        return [
          { widget, value: toPreviewText(outputs.getNodeOutputs(node)?.text) }
        ]
      })
    },
    (previews) => {
      for (const { widget, value } of previews)
        if (widget.value !== value) widget.value = value
    },
    { immediate: true }
  )
}
