import { ref } from 'vue'

const POINTER_MOVE_THRESHOLD_SQUARED = 16

export const automaticTooltipSuppressed = ref(false)
export const keyboardInteraction = ref(false)

let pointerOrigin: { x: number; y: number } | undefined

function suppressAutomaticTooltips(x: number, y: number) {
  keyboardInteraction.value = false
  automaticTooltipSuppressed.value = true
  pointerOrigin = { x, y }
}

function handlePointerDown(event: PointerEvent) {
  suppressAutomaticTooltips(event.clientX, event.clientY)
}

function handleTouchStart(event: TouchEvent) {
  const touch = event.touches[0]
  suppressAutomaticTooltips(touch?.clientX ?? 0, touch?.clientY ?? 0)
}

function handlePointerMove(event: PointerEvent) {
  if (!pointerOrigin || event.pointerType === 'touch') return
  const x = event.clientX - pointerOrigin.x
  const y = event.clientY - pointerOrigin.y
  if (x * x + y * y <= POINTER_MOVE_THRESHOLD_SQUARED) return
  pointerOrigin = undefined
  automaticTooltipSuppressed.value = false
}

function handleKeyboardInteraction() {
  keyboardInteraction.value = true
  pointerOrigin = undefined
  automaticTooltipSuppressed.value = false
}

export function resetTooltipInputModality() {
  pointerOrigin = undefined
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
