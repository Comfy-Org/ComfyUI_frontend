// PrimeVue overlays (Select, ColorPicker, Popover, Autocomplete, stacked
// PrimeVue Dialogs) teleport to body. Reka treats clicks on body-portaled
// elements as outside its dialog and would auto-dismiss on the first
// interaction, tearing the overlay down mid-interaction. Treat any
// PrimeVue overlay click as inside.
const PRIMEVUE_OVERLAY_SELECTORS =
  '.p-select-overlay, .p-colorpicker-panel, .p-popover, .p-autocomplete-overlay, .p-overlay, .p-overlay-mask, .p-dialog'

type PointerDownOutsideEvent = CustomEvent<{ originalEvent: PointerEvent }>

export function onRekaPointerDownOutside(
  options: { dismissableMask?: boolean },
  event: PointerDownOutsideEvent
) {
  const target = event.detail.originalEvent.target
  if (target instanceof Element && target.closest(PRIMEVUE_OVERLAY_SELECTORS)) {
    event.preventDefault()
    return
  }
  if (options.dismissableMask === false) {
    event.preventDefault()
  }
}
