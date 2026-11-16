import { onScopeDispose } from 'vue'

import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import type { InputWidgetConfig } from '@/platform/workflow/management/stores/comfyWorkflow'

const RESIZABLE_SELECTOR = 'textarea, [data-slot="drop-zone-indicator"]'

export function useAppModeWidgetResizing(
  onResize: (widget: IBaseWidget, config: InputWidgetConfig) => void
) {
  let pendingHandler: (() => void) | null = null

  function clearPendingHandler() {
    if (!pendingHandler) return
    window.removeEventListener('pointerup', pendingHandler, true)
    window.removeEventListener('pointercancel', pendingHandler, true)
    pendingHandler = null
  }

  onScopeDispose(clearPendingHandler)

  function onPointerDown(widget: IBaseWidget, event: PointerEvent) {
    const wrapper = event.currentTarget
    const target = event.target
    if (!(wrapper instanceof HTMLElement) || !(target instanceof HTMLElement))
      return
    const resizable = target.closest<HTMLElement>(RESIZABLE_SELECTOR)
    if (!resizable || !wrapper.contains(resizable)) return

    clearPendingHandler()

    const startHeight = resizable.offsetHeight
    const handler = () => {
      window.removeEventListener('pointerup', handler, true)
      window.removeEventListener('pointercancel', handler, true)
      pendingHandler = null
      const height = resizable.offsetHeight
      if (height === startHeight) return
      onResize(widget, { height })
    }
    pendingHandler = handler
    window.addEventListener('pointerup', handler, true)
    window.addEventListener('pointercancel', handler, true)
  }

  return { onPointerDown }
}
