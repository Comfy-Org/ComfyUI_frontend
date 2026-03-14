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

const isNode = (value: EventTarget | null | undefined): value is Node =>
  value instanceof Node

const isInside = (target: Node, element: HTMLElement | null | undefined) =>
  !!element?.contains(target)

export function useDismissableOverlay({
  isOpen,
  getOverlayEl,
  onDismiss,
  getTriggerEl,
  dismissOnScroll = false
}: UseDismissableOverlayOptions) {
  const dismissIfOutside = (event: PointerEvent) => {
    if (!toValue(isOpen) || !isNode(event.target)) {
      return
    }

    const overlay = getOverlayEl()
    if (!overlay) {
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
    useEventListener(
      window,
      'scroll',
      () => {
        if (!toValue(isOpen)) {
          return
        }

        onDismiss()
      },
      {
        capture: true,
        passive: true
      }
    )
  }
}
