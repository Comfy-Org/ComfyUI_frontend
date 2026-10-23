import {
  draggable,
  dropTargetForElements
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { onBeforeUnmount, onMounted, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

export function usePragmaticDroppable(
  dropTargetElement: MaybeRefOrGetter<HTMLElement | null>,
  options: Omit<Parameters<typeof dropTargetForElements>[0], 'element'>
) {
  let cleanup = () => {}

  onMounted(() => {
    cleanup = watch(
      () => toValue(dropTargetElement),
      (element, _previous, onCleanup) => {
        if (!element) return
        onCleanup(dropTargetForElements({ element, ...options }))
      },
      { immediate: true, flush: 'post' }
    )
  })

  onBeforeUnmount(() => {
    cleanup()
  })
}

export function usePragmaticDraggable(
  draggableElement: MaybeRefOrGetter<HTMLElement | null>,
  options: Omit<Parameters<typeof draggable>[0], 'element'>
) {
  let cleanup = () => {}

  onMounted(() => {
    const element = toValue(draggableElement)

    if (!element) {
      return
    }

    cleanup = draggable({
      element,
      ...options
    })
    // TODO: Change to onScopeDispose
  })

  onBeforeUnmount(() => {
    cleanup()
  })
}
