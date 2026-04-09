import { useDebounceFn, useResizeObserver } from '@vueuse/core'
import { shallowRef } from 'vue'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { InputWidgetConfig } from '@/platform/workflow/management/stores/comfyWorkflow'

interface ResizableEntry {
  el: HTMLElement
  nodeId: NodeId
  widgetName: string
}

const RESIZABLE_SELECTOR = 'textarea, [data-slot="drop-zone-indicator"]'

export function useAppModeWidgetResizing(
  onResize: (
    nodeId: NodeId,
    widgetName: string,
    config: InputWidgetConfig
  ) => void
) {
  const resizablesByKey = new Map<string, ResizableEntry>()
  const resizablesByEl = new WeakMap<HTMLElement, ResizableEntry>()
  const observedElements = shallowRef<HTMLElement[]>([])

  const persistHeight = useDebounceFn(
    (nodeId: NodeId, widgetName: string, height: number) => {
      onResize(nodeId, widgetName, { height })
    },
    100
  )

  useResizeObserver(observedElements, (entries) => {
    for (const entry of entries) {
      const el = entry.target as HTMLElement
      // Only persist user-initiated resizes (browser sets inline style.height on drag)
      if (!el.style.height) continue
      const info = resizablesByEl.get(el)
      if (!info) continue
      persistHeight(info.nodeId, info.widgetName, el.offsetHeight)
    }
  })

  function syncObservedElements() {
    observedElements.value = [...resizablesByKey.values()].map((r) => r.el)
  }

  function trackResizable(
    el: unknown,
    key: string,
    nodeId: NodeId,
    widgetName: string
  ) {
    const prev = resizablesByKey.get(key)
    if (prev) resizablesByEl.delete(prev.el)
    resizablesByKey.delete(key)

    if (el instanceof HTMLElement) {
      const resizable = el.querySelector<HTMLElement>(RESIZABLE_SELECTOR)
      if (resizable) {
        const entry = { el: resizable, nodeId, widgetName }
        resizablesByKey.set(key, entry)
        resizablesByEl.set(resizable, entry)
      }
    }

    syncObservedElements()
  }

  return { trackResizable, observedElements }
}
