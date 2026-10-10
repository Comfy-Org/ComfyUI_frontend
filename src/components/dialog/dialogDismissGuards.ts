// Reka portals its dialogs / popovers / menus into the body. When a
// separately rooted Reka layer opens on top of a dialog, the dialog's
// DismissableLayer sees a pointer-down on it as "outside" and would dismiss
// itself. These selectors cover the portaled roots so we can treat
// interactions on them as inside.
const REKA_PORTAL_SELECTORS =
  '[data-reka-popper-content-wrapper], [data-reka-dialog-content], [data-reka-menu-content], [data-reka-context-menu-content], [data-reka-nested-dialog-overlay], [role="dialog"], [role="menu"], [role="listbox"], [role="tooltip"]'

// Dismissing a toast or using a docked progress panel over a dialog must not
// take the dialog with it; the empty viewport space beside a toast stays an
// ordinary scrim click.
const TOAST_SELECTORS = '[data-toast-kind], [data-toast-dock]'

const OUTSIDE_LAYER_SELECTORS = `${REKA_PORTAL_SELECTORS}, ${TOAST_SELECTORS}`

type OutsideEvent = CustomEvent<{ originalEvent: Event }>

function isInsideOverlay(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(OUTSIDE_LAYER_SELECTORS) !== null
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
