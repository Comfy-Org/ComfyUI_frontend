import {
  draggable,
  dropTargetForElements
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { onBeforeUnmount, onMounted } from 'vue'

export function usePragmaticDroppable(
  dropTargetElement: HTMLElement | (() => HTMLElement),
  options: Omit<Parameters<typeof dropTargetForElements>[0], 'element'>
) {
  let cleanup = () => {}

  onMounted(() => {
    const element =
      typeof dropTargetElement === 'function'
        ? dropTargetElement()
        : dropTargetElement

    if (!element) {
      return
    }

    cleanup = dropTargetForElements({
      element,
      ...options
    })
  })

  onBeforeUnmount(() => {
    cleanup()
  })
}

export function usePragmaticDraggable(
  draggableElement: HTMLElement | (() => HTMLElement),
  options: Omit<Parameters<typeof draggable>[0], 'element'>
) {
  let cleanup = () => {}

  onMounted(() => {
    const element =
      typeof draggableElement === 'function'
        ? draggableElement()
        : draggableElement

    if (!element) {
      return
    }

    cleanup = draggable({
      element,
      ...options
    })
  })

  onBeforeUnmount(() => {
    cleanup()
  })
}
