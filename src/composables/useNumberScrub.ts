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
    onScrubStart,
    onScrub,
    onClick
  }: {
    value: MaybeRefOrGetter<number>
    min: MaybeRefOrGetter<number>
    max: MaybeRefOrGetter<number>
    step: MaybeRefOrGetter<number>
    disabled: MaybeRefOrGetter<boolean>
    onScrubStart: () => number
    onScrub: (value: number) => void
    onClick: () => void
  }
) {
  let startValue = 0
  let unitsPerPixel = 0
  let dragged = false
  let editingControl = true
  const swipe = usePointerSwipe(target, {
    threshold: 3,
    onSwipeStart: (event) => {
      dragged = false
      editingControl = isEditingControl(event.target)
    },
    onSwipe: () => {
      if (toValue(disabled) || editingControl) return
      if (!dragged) {
        if (!['left', 'right'].includes(swipe.direction.value)) return
        startValue = onScrubStart()
        const width = toValue(target)?.getBoundingClientRect().width ?? 0
        const span = Math.min(
          toValue(max) - toValue(min),
          Math.abs(startValue) * 2
        )
        unitsPerPixel = Math.max(toValue(step), width > 0 ? span / width : 0)
      }
      dragged = true
      if (
        !Number.isFinite(startValue) ||
        Math.abs(startValue) > Number.MAX_SAFE_INTEGER
      )
        return
      const increment = toValue(step)
      const delta = -swipe.distanceX.value * unitsPerPixel
      const offset =
        increment > 0 ? Math.round(delta / increment) * increment : delta
      const nextValue = Math.min(
        toValue(max),
        Math.max(toValue(min), startValue + offset)
      )
      if (nextValue !== toValue(value)) onScrub(nextValue)
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
