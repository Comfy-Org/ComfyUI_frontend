import { useEventListener, usePointerSwipe, whenever } from '@vueuse/core'
import { toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

export function useNumberScrub(
  target: MaybeRefOrGetter<HTMLElement | null | undefined>,
  {
    disabled,
    onScrub,
    onClick
  }: {
    disabled: MaybeRefOrGetter<boolean>
    onScrub: (steps: number) => void
    onClick: () => void
  }
) {
  let dragDelta = 0
  let dragged = false
  let editingControl = false
  const swipe = usePointerSwipe(target, {
    onSwipeStart: (event) => {
      dragDelta = 0
      dragged = false
      editingControl = isEditingControl(event.target)
    },
    onSwipeEnd: () => (dragDelta = 0)
  })

  whenever(swipe.distanceX, () => {
    if (toValue(disabled) || editingControl) return
    const delta = ((swipe.distanceX.value - dragDelta) / 10) | 0
    dragDelta += delta * 10
    dragged ||= delta !== 0
    onScrub(-delta)
  })

  useEventListener(target, 'click', (event) => {
    if (dragged) event.preventDefault()
    else if (!toValue(disabled) && !isEditingControl(event.target)) onClick()
  })
}

function isEditingControl(target: EventTarget | null) {
  return target instanceof HTMLElement && !!target.closest('button, input')
}
