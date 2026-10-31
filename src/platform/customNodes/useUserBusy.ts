import { useActiveElement, useEventListener } from '@vueuse/core'
import { computed, ref } from 'vue'
import type { ComputedRef } from 'vue'

function isTextField(element: Element | null | undefined): boolean {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    (element instanceof HTMLElement && element.isContentEditable)
  )
}

export function useUserBusy(): ComputedRef<boolean> {
  const pointerHeld = ref(false)
  const activeElement = useActiveElement({ triggerOnRemoval: true })
  useEventListener(
    window,
    'pointerdown',
    () => {
      pointerHeld.value = true
    },
    { capture: true }
  )
  useEventListener(
    window,
    ['pointerup', 'pointercancel'],
    () => {
      pointerHeld.value = false
    },
    { capture: true }
  )
  return computed(() => pointerHeld.value || isTextField(activeElement.value))
}
