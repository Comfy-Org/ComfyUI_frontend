import { MODAL_LAYER_SELECTOR } from '@/utils/modalLayerStack'

// Body-portaled layers live outside the dialog's DOM subtree, so Reka reports
// interactions on them as "outside". Treat a target as inside when it belongs
// to another Reka layer or to a non-scrim surface raised on the shared modal
// stack (toasts, tours, loading overlay).
const REKA_LAYER_SELECTORS = `[data-dismissable-layer], [data-reka-popper-content-wrapper], ${MODAL_LAYER_SELECTOR}:not([data-slot="dialog-overlay"])`

// Dismissing a toast or using a docked progress panel over a dialog must not
// take the dialog with it; the empty viewport space beside a toast stays an
// ordinary scrim click.
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
