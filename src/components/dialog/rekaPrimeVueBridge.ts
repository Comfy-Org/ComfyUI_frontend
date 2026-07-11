// PrimeVue overlays (Select, ColorPicker, Popover, Autocomplete, stacked
// PrimeVue Dialogs) teleport to body. Reka treats clicks on body-portaled
// elements as outside its dialog and would auto-dismiss on the first
// interaction, tearing the overlay down mid-interaction. Treat any
// PrimeVue overlay click as inside.
const PRIMEVUE_OVERLAY_SELECTORS =
  '.p-select-overlay, .p-colorpicker-panel, .p-popover, .p-autocomplete-overlay, .p-overlay, .p-overlay-mask, .p-dialog'

// Reka portals its own dialogs / popovers / menus into the body too. When a
// nested Reka layer opens on top of a non-modal parent, the parent's
// DismissableLayer sees the focus shift / pointer-down as "outside" and would
// dismiss itself. These selectors cover the portaled roots so we can treat
// interactions on them as inside.
const REKA_PORTAL_SELECTORS =
  '[data-reka-popper-content-wrapper], [data-reka-dialog-content], [data-reka-menu-content], [data-reka-context-menu-content], [role="dialog"], [role="menu"], [role="listbox"], [role="tooltip"]'

const OUTSIDE_LAYER_SELECTORS = `${PRIMEVUE_OVERLAY_SELECTORS}, ${REKA_PORTAL_SELECTORS}`

type OutsideEvent = CustomEvent<{ originalEvent: Event }>

function isInsideOverlay(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(OUTSIDE_LAYER_SELECTORS) !== null
  )
}

export function onRekaPointerDownOutside(
  options: { dismissableMask?: boolean },
  event: OutsideEvent,
  isActive = true
) {
  // Stacked dialogs each render an independent Reka `Dialog` root, so a lower
  // dialog's DismissableLayer sees a pointer-down that opened (or landed on)
  // the dialog above it as "outside" and would dismiss itself — including via
  // the upper dialog's overlay, whose element matches none of the portal
  // selectors below. Only the top-most dialog may dismiss on an outside
  // pointer, mirroring the escape-key handling in `GlobalDialog`.
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
// nested Reka or PrimeVue dialog teleported to body). Without this guard a
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
