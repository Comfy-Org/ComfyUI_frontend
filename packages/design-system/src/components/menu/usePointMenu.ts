import { useEventListener } from '@vueuse/core'
import { computed, ref, shallowRef } from 'vue'

import { getMenuAnchorPosition, isMenuDismissalClick } from './menuAnchor'

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
    if (open.value || isMenuDismissalClick(event, shownFrom, dismissingPress))
      hide()
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
