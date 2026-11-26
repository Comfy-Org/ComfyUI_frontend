import { useEventListener, usePointerSwipe } from '@vueuse/core'
import { toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

export function useNumberScrub(
  target: MaybeRefOrGetter<HTMLElement | null | undefined>,
  {
    value,
    min,
    max,
    step,
    disabled,
    onScrub,
    onClick
  }: {
    value: MaybeRefOrGetter<number>
    min: MaybeRefOrGetter<number>
    max: MaybeRefOrGetter<number>
    step: MaybeRefOrGetter<number>
    disabled: MaybeRefOrGetter<boolean>
    onScrub: (value: number) => void
    onClick: () => void
  }
) {
  let startValue = 0
  let dragged = false
  let blockedAtStart = true
  const swipe = usePointerSwipe(target, {
    threshold: 3,
    onSwipeStart: (event) => {
      dragged = false
      blockedAtStart = toValue(disabled) || isEditingControl(event.target)
    },
    onSwipe: () => {
      if (toValue(disabled) || blockedAtStart) return
      if (!dragged) {
        if (!['left', 'right'].includes(swipe.direction.value)) return
        startValue = toValue(value)
      }
      dragged = true
      if (!(Math.abs(startValue) <= Number.MAX_SAFE_INTEGER)) return
      const offset = Math.round(-swipe.distanceX.value) * toValue(step)
      const nextValue = Math.min(
        toValue(max),
        Math.max(toValue(min), startValue + offset)
      )
      onScrub(nextValue)
    }
  })

  useEventListener(target, 'click', (event) => {
    if (dragged) event.preventDefault()
    else if (!toValue(disabled) && !isEditingControl(event.target)) onClick()
  })
}

function isEditingControl(target: EventTarget | null) {
  return target instanceof HTMLElement && !!target.closest('button, input')
}
