import { useEventListener } from '@vueuse/core'

import { toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

interface UseDismissableOverlayOptions {
  isOpen: MaybeRefOrGetter<boolean>
  getOverlayEl: () => HTMLElement | null
  onDismiss: () => void
  getTriggerEl?: () => HTMLElement | null
  dismissOnScroll?: boolean
}

function isNode(value: EventTarget | null | undefined): value is Node {
  return value instanceof Node
}

function isInside(target: Node, element: HTMLElement | null | undefined) {
  return !!element?.contains(target)
}

export function useDismissableOverlay({
  isOpen,
  getOverlayEl,
  onDismiss,
  getTriggerEl,
  dismissOnScroll = false
}: UseDismissableOverlayOptions) {
  function dismissIfOutside(event: Event) {
    if (!toValue(isOpen)) {
      return
    }

    const overlay = getOverlayEl()
    if (!overlay) {
      return
    }

    if (!isNode(event.target)) {
      onDismiss()
      return
    }

    if (
      isInside(event.target, overlay) ||
      isInside(event.target, getTriggerEl?.())
    ) {
      return
    }

    onDismiss()
  }

  useEventListener(window, 'pointerdown', dismissIfOutside, { capture: true })

  if (dismissOnScroll) {
    useEventListener(window, 'scroll', dismissIfOutside, {
      capture: true,
      passive: true
    })
  }
}
