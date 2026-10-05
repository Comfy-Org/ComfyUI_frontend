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
  options: { dismissableMask?: boolean },
  event: OutsideEvent,
  isActive = true
) {
  // Stacked dialogs each render an independent Reka `Dialog` root, so a lower
  // dialog's DismissableLayer sees a pointer-down that opened (or landed on)
  // the dialog above it as "outside" and would dismiss itself. Only the
  // top-most dialog may dismiss on an outside pointer, mirroring the escape-key
  // handling in `GlobalDialog`.
  if (!isActive) {
    event.preventDefault()
    return
  }
  if (isInsideOverlay(event.detail.originalEvent.target)) {
    event.preventDefault()
    return
  }
  if (options.dismissableMask === false) {
    event.preventDefault()
  }
}

// Focus / interact-outside fires when focus moves to a sibling portal (a
// nested dialog teleported to body). Without this guard a
// non-modal Reka dialog would dismiss itself the moment a nested dialog
// receives focus.
//
// A container dialog (e.g. Settings) that hosts nested confirm/edit dialogs can
// also lose focus to an ordinary app element — not just a portal — when a
// nested dialog closes and the element it focused was removed (deleting the
// selected row). That programmatic focus shift is not a dismiss intent, so such
// a dialog opts out of focus-outside dismissal entirely via
// `dismissOnFocusOutside: false`; it still dismisses on escape or an outside
// pointer.
export function onRekaFocusOutside(
  event: OutsideEvent,
  options: { dismissOnFocusOutside?: boolean } = {}
) {
  if (options.dismissOnFocusOutside === false) {
    event.preventDefault()
    return
  }
  if (isInsideOverlay(event.detail.originalEvent.target)) {
    event.preventDefault()
  }
}
