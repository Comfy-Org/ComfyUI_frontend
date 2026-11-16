import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import type { InputWidgetConfig } from '@/platform/workflow/management/stores/comfyWorkflow'

const RESIZABLE_SELECTOR = 'textarea, [data-slot="drop-zone-indicator"]'

export function useAppModeWidgetResizing(
  onResize: (widget: IBaseWidget, config: InputWidgetConfig) => void
) {
  let gesture:
    | { widget: IBaseWidget; resizable: HTMLElement; startHeight: number }
    | undefined

  function onPointerDown(widget: IBaseWidget, event: PointerEvent) {
    const wrapper = event.currentTarget
    const target = event.target
    if (!(wrapper instanceof HTMLElement) || !(target instanceof HTMLElement))
      return
    const resizable = target.closest<HTMLElement>(RESIZABLE_SELECTOR)
    if (!resizable || !wrapper.contains(resizable)) return

    gesture = { widget, resizable, startHeight: resizable.offsetHeight }
  }

  function onPointerUp() {
    if (!gesture) return
    const { widget, resizable, startHeight } = gesture
    gesture = undefined
    const height = resizable.offsetHeight
    if (height !== startHeight) onResize(widget, { height })
  }

  return { onPointerDown, onPointerUp }
}
