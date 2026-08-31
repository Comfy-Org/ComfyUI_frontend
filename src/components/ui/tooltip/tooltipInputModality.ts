import { ref } from 'vue'

const POINTER_MOVE_THRESHOLD_SQUARED = 16
const POINTER_FOCUS_WINDOW_MS = 100
const KEYBOARD_FOCUS_WINDOW_MS = 100

export const automaticTooltipSuppressed = ref(false)
export const keyboardInteraction = ref(false)
export const touchInteraction = ref(false)

let pointerMovementSquared = 0
let keyboardInteractionTimer: ReturnType<typeof setTimeout> | undefined
let pointerInteractionTimer: ReturnType<typeof setTimeout> | undefined

function suppressAutomaticTooltips() {
  if (keyboardInteractionTimer) clearTimeout(keyboardInteractionTimer)
  keyboardInteractionTimer = undefined
  keyboardInteraction.value = false
  automaticTooltipSuppressed.value = true
  pointerMovementSquared = 0
}

function handlePointerDown(event: PointerEvent) {
  if (pointerInteractionTimer) clearTimeout(pointerInteractionTimer)
  touchInteraction.value = event.pointerType === 'touch'
  suppressAutomaticTooltips()
  if (touchInteraction.value) return
  pointerInteractionTimer = setTimeout(() => {
    automaticTooltipSuppressed.value = false
    pointerInteractionTimer = undefined
  }, POINTER_FOCUS_WINDOW_MS)
}

function handleTouchStart() {
  touchInteraction.value = true
  suppressAutomaticTooltips()
}

function handlePointerMove(event: PointerEvent) {
  if (!automaticTooltipSuppressed.value || event.pointerType === 'touch') return
  pointerMovementSquared +=
    event.movementX * event.movementX + event.movementY * event.movementY
  if (pointerMovementSquared <= POINTER_MOVE_THRESHOLD_SQUARED) return
  pointerMovementSquared = 0
  touchInteraction.value = false
  automaticTooltipSuppressed.value = false
}

function handlePointerOver(event: PointerEvent) {
  if (event.pointerType !== 'mouse' || touchInteraction.value) return
  pointerMovementSquared = 0
  automaticTooltipSuppressed.value = false
}

function handleKeyboardInteraction() {
  if (keyboardInteractionTimer) clearTimeout(keyboardInteractionTimer)
  keyboardInteraction.value = true
  pointerMovementSquared = 0
  touchInteraction.value = false
  automaticTooltipSuppressed.value = false
  keyboardInteractionTimer = setTimeout(() => {
    keyboardInteraction.value = false
    keyboardInteractionTimer = undefined
  }, KEYBOARD_FOCUS_WINDOW_MS)
}

export function resetTooltipInputModality() {
  if (keyboardInteractionTimer) clearTimeout(keyboardInteractionTimer)
  if (pointerInteractionTimer) clearTimeout(pointerInteractionTimer)
  keyboardInteractionTimer = undefined
  pointerInteractionTimer = undefined
  pointerMovementSquared = 0
  touchInteraction.value = false
  automaticTooltipSuppressed.value = false
  keyboardInteraction.value = false
}

function removeListeners() {
  document.removeEventListener('pointerdown', handlePointerDown, true)
  document.removeEventListener('pointermove', handlePointerMove, true)
  document.removeEventListener('pointerover', handlePointerOver, true)
  document.removeEventListener('touchstart', handleTouchStart, true)
  document.removeEventListener('keydown', handleKeyboardInteraction)
  resetTooltipInputModality()
}

if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', handlePointerDown, {
    capture: true,
    passive: true
  })
  document.addEventListener('pointermove', handlePointerMove, {
    capture: true,
    passive: true
  })
  document.addEventListener('pointerover', handlePointerOver, {
    capture: true,
    passive: true
  })
  document.addEventListener('touchstart', handleTouchStart, {
    capture: true,
    passive: true
  })
  document.addEventListener('keydown', handleKeyboardInteraction)
  import.meta.hot?.dispose(removeListeners)
}
