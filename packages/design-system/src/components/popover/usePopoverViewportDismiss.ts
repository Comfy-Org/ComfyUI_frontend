import { useEventListener } from '@vueuse/core'
import type { MaybeRefOrGetter, Ref } from 'vue'
import { toValue } from 'vue'

export function usePopoverViewportDismiss(
  open: Ref<boolean>,
  anchor: MaybeRefOrGetter<Element | null | undefined>
) {
  useEventListener(
    () => (open.value ? window : undefined),
    'resize',
    () => {
      open.value = false
    }
  )
  useEventListener(
    () => (open.value ? window : undefined),
    'scroll',
    (event) => {
      if (
        event.target === document ||
        event.target instanceof Window ||
        (event.target instanceof Element &&
          event.target.contains(toValue(anchor) ?? null))
      )
        open.value = false
    },
    { capture: true }
  )
}
