import { ref } from 'vue'

const POINTER_MOVE_THRESHOLD_SQUARED = 16
const KEYBOARD_FOCUS_WINDOW_MS = 100

export const automaticTooltipSuppressed = ref(false)
export const keyboardInteraction = ref(false)

let pointerMovementSquared = 0
let keyboardInteractionTimer: ReturnType<typeof setTimeout> | undefined

function suppressAutomaticTooltips() {
  if (keyboardInteractionTimer) clearTimeout(keyboardInteractionTimer)
  keyboardInteractionTimer = undefined
  keyboardInteraction.value = false
  automaticTooltipSuppressed.value = true
  pointerMovementSquared = 0
}

function handlePointerDown() {
  suppressAutomaticTooltips()
}

function handleTouchStart() {
  suppressAutomaticTooltips()
}

function handlePointerMove(event: PointerEvent) {
  if (!automaticTooltipSuppressed.value || event.pointerType === 'touch') return
  pointerMovementSquared +=
    event.movementX * event.movementX + event.movementY * event.movementY
  if (pointerMovementSquared <= POINTER_MOVE_THRESHOLD_SQUARED) return
  pointerMovementSquared = 0
  automaticTooltipSuppressed.value = false
}

function handleKeyboardInteraction() {
  if (keyboardInteractionTimer) clearTimeout(keyboardInteractionTimer)
  keyboardInteraction.value = true
  pointerMovementSquared = 0
  automaticTooltipSuppressed.value = false
  keyboardInteractionTimer = setTimeout(() => {
    keyboardInteraction.value = false
    keyboardInteractionTimer = undefined
  }, KEYBOARD_FOCUS_WINDOW_MS)
}

export function resetTooltipInputModality() {
  if (keyboardInteractionTimer) clearTimeout(keyboardInteractionTimer)
  keyboardInteractionTimer = undefined
  pointerMovementSquared = 0
  automaticTooltipSuppressed.value = false
  keyboardInteraction.value = false
}

function removeListeners() {
  document.removeEventListener('pointerdown', handlePointerDown)
  document.removeEventListener('pointermove', handlePointerMove)
  document.removeEventListener('touchstart', handleTouchStart)
  document.removeEventListener('keydown', handleKeyboardInteraction)
  resetTooltipInputModality()
}

if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', handlePointerDown, {
    passive: true
  })
  document.addEventListener('pointermove', handlePointerMove, {
    passive: true
  })
  document.addEventListener('touchstart', handleTouchStart, {
    passive: true
  })
  document.addEventListener('keydown', handleKeyboardInteraction)
  import.meta.hot?.dispose(removeListeners)
}
