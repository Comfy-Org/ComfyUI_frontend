import { MODAL_LAYER_SELECTOR } from '@/utils/modalLayerStack'

const REKA_LAYER_SELECTORS = `[data-dismissable-layer], [data-reka-popper-content-wrapper], ${MODAL_LAYER_SELECTOR}:not([data-slot="dialog-overlay"])`

const TOAST_SELECTORS = '[data-toast-kind], [data-toast-dock]'

const OWNED_LAYER_SELECTORS = `${REKA_LAYER_SELECTORS}, ${TOAST_SELECTORS}`

type OutsideEvent = CustomEvent<{ originalEvent: Event }>

function isInsideOverlay(target: EventTarget | null): boolean {
  return (
    target instanceof Element && target.closest(OWNED_LAYER_SELECTORS) !== null
  )
}

export function onRekaPointerDownOutside(
  options: { dismissOnPointerDownOutside?: boolean },
  event: OutsideEvent
) {
  if (isInsideOverlay(event.detail.originalEvent.target)) {
    event.preventDefault()
    return
  }
  if (options.dismissOnPointerDownOutside === false) {
    event.preventDefault()
  }
}
