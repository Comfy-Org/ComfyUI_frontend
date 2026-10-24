import { useEventListener } from '@vueuse/core'
import { computed, ref, shallowRef } from 'vue'

import { getMenuAnchorPosition } from './menuAnchor'

/**
 * State for a non-modal menu opened from code at the event's pointer or element.
 * Bind `menuProps` to a `Menu`; any outside press closes it, even one stopped before reaching the document.
 */
export function usePointMenu(onShow?: (event: Event) => void) {
  const open = ref(false)
  const reference = shallowRef<{ getBoundingClientRect: () => DOMRect }>()
  let shownFrom: EventTarget | null = null
  let dismissingPress: Node | null = null

  function show(event: Event) {
    dismissingPress = null
    shownFrom = event.currentTarget
    onShow?.(event)
    const { x, y } = getMenuAnchorPosition(event)
    reference.value = { getBoundingClientRect: () => new DOMRect(x, y, 1, 1) }
    open.value = true
  }

  function hide() {
    dismissingPress = null
    open.value = false
  }

  function toggle(event: Event) {
    const control = event.currentTarget
    const pressDismissedMenu =
      event instanceof MouseEvent &&
      event.detail > 0 &&
      control instanceof Node &&
      control === shownFrom &&
      dismissingPress !== null &&
      control.contains(dismissingPress)
    if (open.value || pressDismissedMenu) hide()
    else show(event)
  }

  useEventListener(
    document,
    'pointerdown',
    ({ target }) => {
      dismissingPress = null
      if (!open.value) return
      if (target instanceof Element && target.closest('[role="menu"]')) return
      dismissingPress = target instanceof Node ? target : null
      open.value = false
    },
    { capture: true }
  )

  const menuProps = computed(() => ({
    open: open.value,
    'onUpdate:open': (value: boolean) => {
      open.value = value
    },
    reference: reference.value,
    modal: false,
    onFocusOutside: (event: Event) => event.preventDefault()
  }))

  return { open, menuProps, show, hide, toggle }
}
