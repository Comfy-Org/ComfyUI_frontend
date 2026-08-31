import { ref } from 'vue'

const POINTER_TOOLTIP_SUPPRESSION_MS = 700

export const automaticTooltipSuppressed = ref(false)
export const keyboardInteraction = ref(false)

let pointerSuppressionTimer: ReturnType<typeof setTimeout> | undefined

function handlePointerInteraction() {
  keyboardInteraction.value = false
  automaticTooltipSuppressed.value = true
  if (pointerSuppressionTimer) clearTimeout(pointerSuppressionTimer)
  pointerSuppressionTimer = setTimeout(() => {
    automaticTooltipSuppressed.value = false
    pointerSuppressionTimer = undefined
  }, POINTER_TOOLTIP_SUPPRESSION_MS)
}

function handleKeyboardInteraction() {
  keyboardInteraction.value = true
}

export function resetTooltipInputModality() {
  if (pointerSuppressionTimer) clearTimeout(pointerSuppressionTimer)
  pointerSuppressionTimer = undefined
  automaticTooltipSuppressed.value = false
  keyboardInteraction.value = false
}

function removeListeners() {
  document.removeEventListener('pointerdown', handlePointerInteraction)
  document.removeEventListener('touchstart', handlePointerInteraction)
  document.removeEventListener('keydown', handleKeyboardInteraction)
  resetTooltipInputModality()
}

if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', handlePointerInteraction, {
    passive: true
  })
  document.addEventListener('touchstart', handlePointerInteraction, {
    passive: true
  })
  document.addEventListener('keydown', handleKeyboardInteraction)
  import.meta.hot?.dispose(removeListeners)
}
