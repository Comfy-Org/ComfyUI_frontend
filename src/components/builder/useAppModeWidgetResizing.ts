import { onScopeDispose } from 'vue'

import type { InputWidgetConfig } from '@/platform/workflow/management/stores/comfyWorkflow'
import type { WidgetEntityId } from '@/world/entityIds'

const RESIZABLE_SELECTOR = 'textarea, [data-slot="drop-zone-indicator"]'

export function useAppModeWidgetResizing(
  onResize: (entityId: WidgetEntityId, config: InputWidgetConfig) => void
) {
  let pendingHandler: (() => void) | null = null

  function clearPendingHandler() {
    if (!pendingHandler) return
    window.removeEventListener('pointerup', pendingHandler)
    window.removeEventListener('pointercancel', pendingHandler)
    pendingHandler = null
  }

  onScopeDispose(clearPendingHandler)

  function onPointerDown(entityId: WidgetEntityId, event: PointerEvent) {
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
      onResize(entityId, { height })
    }
    pendingHandler = handler
    window.addEventListener('pointerup', handler)
    window.addEventListener('pointercancel', handler)
  }

  return { onPointerDown }
}
