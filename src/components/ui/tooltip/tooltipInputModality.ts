import { ref } from 'vue'

const POINTER_MOVE_THRESHOLD_SQUARED = 16

export const automaticTooltipSuppressed = ref(false)
export const keyboardInteraction = ref(false)

let pointerMovementSquared = 0

function suppressAutomaticTooltips() {
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
  keyboardInteraction.value = true
  pointerMovementSquared = 0
  automaticTooltipSuppressed.value = false
}

export function resetTooltipInputModality() {
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
