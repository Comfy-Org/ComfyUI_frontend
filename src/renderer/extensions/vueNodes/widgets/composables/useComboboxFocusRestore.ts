import type { FocusOutsideEvent } from 'reka-ui'
import type { Ref } from 'vue'
import { onBeforeUnmount, ref } from 'vue'

export function useComboboxFocusRestore(
  inputContainerRef: Ref<HTMLElement | undefined>
) {
  const shouldRestoreFocusOnFocusOutside = ref(false)
  let clearPointerDownTimer: number | undefined

  function focusInput() {
    inputContainerRef.value
      ?.querySelector<HTMLInputElement>('input')
      ?.focus({ preventScroll: true })
  }

  function clearPointerDown() {
    shouldRestoreFocusOnFocusOutside.value = false
    window.clearTimeout(clearPointerDownTimer)
    clearPointerDownTimer = undefined
    window.removeEventListener('pointerup', clearPointerDown)
    window.removeEventListener('pointercancel', clearPointerDown)
  }

  function handleViewportPointerDown() {
    clearPointerDown()
    shouldRestoreFocusOnFocusOutside.value = true
    clearPointerDownTimer = window.setTimeout(clearPointerDown, 0)
    window.addEventListener('pointerup', clearPointerDown, { once: true })
    window.addEventListener('pointercancel', clearPointerDown, { once: true })
  }

  function handleFocusOutside(event: FocusOutsideEvent) {
    if (!shouldRestoreFocusOnFocusOutside.value) return

    event.preventDefault()
    focusInput()
    clearPointerDown()
  }

  onBeforeUnmount(clearPointerDown)

  return {
    handleFocusOutside,
    handleViewportPointerDown
  }
}
