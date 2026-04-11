import { onScopeDispose } from 'vue'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { InputWidgetConfig } from '@/platform/workflow/management/stores/comfyWorkflow'

const RESIZABLE_SELECTOR = 'textarea, [data-slot="drop-zone-indicator"]'

export function useAppModeWidgetResizing(
  onResize: (
    nodeId: NodeId,
    widgetName: string,
    config: InputWidgetConfig
  ) => void
) {
  let pendingHandler: (() => void) | null = null

  function clearPendingHandler() {
    if (!pendingHandler) return
    window.removeEventListener('pointerup', pendingHandler)
    window.removeEventListener('pointercancel', pendingHandler)
    pendingHandler = null
  }

  onScopeDispose(clearPendingHandler)

  function onPointerDown(
    nodeId: NodeId,
    widgetName: string,
    event: PointerEvent
  ) {
    const wrapper = event.currentTarget
    const target = event.target
    if (!(wrapper instanceof HTMLElement) || !(target instanceof HTMLElement))
      return
    const resizable = target.closest<HTMLElement>(RESIZABLE_SELECTOR)
    if (!resizable || !wrapper.contains(resizable)) return

    clearPendingHandler()

    const startHeight = resizable.offsetHeight
    const handler = () => {
      window.removeEventListener('pointerup', handler)
      window.removeEventListener('pointercancel', handler)
      pendingHandler = null
      const height = resizable.offsetHeight
      if (height === startHeight) return
      onResize(nodeId, widgetName, { height })
    }
    pendingHandler = handler
    window.addEventListener('pointerup', handler)
    window.addEventListener('pointercancel', handler)
  }

  return { onPointerDown }
}
