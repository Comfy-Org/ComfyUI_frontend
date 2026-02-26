import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { RangeValue } from '@/lib/litegraph/src/types/widgets'
import { useExtensionService } from '@/services/extensionService'

const HISTOGRAM_KEY_PREFIX = 'range_histogram_'

useExtensionService().registerExtension({
  name: 'Comfy.RangeHistogram',

  async nodeCreated(node: LGraphNode) {
    const hasRangeWidget = node.widgets?.some((w) => w.type === 'range')
    if (!hasRangeWidget) return

    const onExecuted = node.onExecuted

    node.onExecuted = function (output: Record<string, unknown>) {
      onExecuted?.call(this, output)

      for (const widget of node.widgets ?? []) {
        if (widget.type !== 'range') continue

        const data = output[HISTOGRAM_KEY_PREFIX + widget.name]
        if (!Array.isArray(data)) continue

        if (widget.options) {
          ;(widget.options as Record<string, unknown>).histogram =
            new Uint32Array(data as number[])
          // Force reactive update: widget.options is not reactive, but
          // widget.value is (via BaseWidget._state). Re-assigning value
          // triggers processedWidgets recomputation in NodeWidgets.vue,
          // which then reads the updated options from the store proxy.
          widget.value = { ...(widget.value as RangeValue) }
        }
      }
    }
  }
})
