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

    if (pendingHandler) window.removeEventListener('pointerup', pendingHandler)

    const startHeight = resizable.offsetHeight
    const handler = () => {
      window.removeEventListener('pointerup', handler)
      pendingHandler = null
      const height = resizable.offsetHeight
      if (height === startHeight) return
      onResize(nodeId, widgetName, { height })
    }
    pendingHandler = handler
    window.addEventListener('pointerup', handler)
  }

  return { onPointerDown }
}
