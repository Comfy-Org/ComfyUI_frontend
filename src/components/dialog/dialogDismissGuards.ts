const REKA_LAYER_SELECTORS =
  '[data-dismissable-layer], [data-reka-popper-content-wrapper]'

const TOAST_SELECTORS = '[data-toast-kind], [data-toast-dock]'

const OWNED_LAYER_SELECTORS = `${REKA_LAYER_SELECTORS}, ${TOAST_SELECTORS}`

type OutsideEvent = CustomEvent<{ originalEvent: Event }>

const IME_PROCESS_KEY_CODE = 229

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

export function onRekaEscapeKeyDown(
  options: { closable?: boolean },
  event: KeyboardEvent
) {
  const isImeKey = event.isComposing || event.keyCode === IME_PROCESS_KEY_CODE
  if (options.closable === false || isImeKey) event.preventDefault()
}
