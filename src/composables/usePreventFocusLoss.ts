import type { Ref } from 'vue'
import { useEventListener } from '@vueuse/core'

const FOCUS_ACCEPTING_SELECTOR =
  'input, textarea, select, [contenteditable="true"]'

/**
 * Prevents non-interactive areas of a container from stealing keyboard focus
 * away from the canvas. Call this on "passive" UI regions (tab bar, sidebar
 * icon strip) so that canvas keybindings remain active after the user clicks
 * within those regions.
 *
 * Focus is still allowed to move when the user clicks a genuine text-entry
 * element (input, textarea, contenteditable).
 */
export function usePreventFocusLoss(el: Ref<HTMLElement | null | undefined>) {
  useEventListener(el, 'mousedown', (event: MouseEvent) => {
    if (!(event.target as HTMLElement).closest(FOCUS_ACCEPTING_SELECTOR)) {
      event.preventDefault()
    }
  })
}
