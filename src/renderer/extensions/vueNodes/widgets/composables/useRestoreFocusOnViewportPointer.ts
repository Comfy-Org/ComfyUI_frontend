import { tryOnScopeDispose } from '@vueuse/core'
import { ref, unref } from 'vue'
import type { MaybeRef } from 'vue'

interface PreventableEvent {
  preventDefault(): void
}

/**
 * Keeps a search input focused when pressing a dropdown viewport.
 * Reka treats native scrollbar presses as focus-outside interactions, so this
 * short-lived guard preserves list scrolling without blocking normal outside
 * clicks after the pointer gesture completes.
 */
export function useRestoreFocusOnViewportPointer(
  focusInput: MaybeRef<() => boolean>
) {
  const isViewportPointerDownInFlight = ref(false)
  let clearPointerDownTimer: number | undefined

  function clearPointerDown() {
    isViewportPointerDownInFlight.value = false
    window.clearTimeout(clearPointerDownTimer)
    clearPointerDownTimer = undefined
    window.removeEventListener('pointerup', clearPointerDown)
    window.removeEventListener('pointercancel', clearPointerDown)
  }

  function handleViewportPointerDown() {
    clearPointerDown()
    isViewportPointerDownInFlight.value = true
    // Clear through timer and terminal pointer events so a canceled or missing
    // pointerup cannot leave future outside interactions blocked.
    clearPointerDownTimer = window.setTimeout(clearPointerDown, 0)
    window.addEventListener('pointerup', clearPointerDown, { once: true })
    window.addEventListener('pointercancel', clearPointerDown, { once: true })
  }

  function handleFocusOutside(event: PreventableEvent) {
    if (!isViewportPointerDownInFlight.value) return
    if (!unref(focusInput)()) {
      clearPointerDown()
      return
    }

    event.preventDefault()
    clearPointerDown()
  }

  tryOnScopeDispose(clearPointerDown)

  return {
    handleFocusOutside,
    handleViewportPointerDown
  }
}
