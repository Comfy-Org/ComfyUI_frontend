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

/**
 * Whether the user is partway through something a graph reload would throw
 * away: a held pointer, or a focused text field. Custom node types arrive
 * asynchronously, so the work that picks them up waits for this to clear.
 *
 * The pointer listeners stay hand-rolled because `LGraphCanvas` ends
 * `processMouseDown` with both `preventDefault()` and `stopPropagation()`.
 * `preventDefault()` on a `pointerdown` suppresses the compatibility
 * `mousedown`, so `useMousePressed` would never see a press on the graph, and
 * `stopPropagation()` is why `capture` here is load-bearing rather than
 * incidental. `useUserBusy.test.ts` pins both.
 */
export function useUserBusy(): ComputedRef<boolean> {
  const pointerHeld = ref(false)
  // Removing a focused field fires no `blur`, so without this the user reads
  // as busy forever once a text widget is destroyed while focused.
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
