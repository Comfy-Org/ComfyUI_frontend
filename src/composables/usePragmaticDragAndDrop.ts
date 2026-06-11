import {
  draggable,
  dropTargetForElements
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { dropTargetForExternal } from '@atlaskit/pragmatic-drag-and-drop/external/adapter'
import {
  containsFiles,
  getFiles
} from '@atlaskit/pragmatic-drag-and-drop/external/file'
import { onBeforeUnmount, onMounted, readonly, ref, toValue } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'

export function usePragmaticDroppable(
  dropTargetElement: MaybeRefOrGetter<HTMLElement | null>,
  options: Omit<Parameters<typeof dropTargetForElements>[0], 'element'>
) {
  let cleanup = () => {}

  onMounted(() => {
    const element = toValue(dropTargetElement)

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

/**
 * Registers an external-file drop target on an element. Exposes a reactive
 * `isDraggingOver` flag for drop affordances and invokes `onDrop` with the
 * dropped `File`s. Internal element drags never satisfy `containsFiles`, so
 * they neither trigger the flag nor the callback.
 */
export function usePragmaticExternalFileDrop(
  dropTargetElement: MaybeRefOrGetter<HTMLElement | null>,
  options: { onDrop: (files: File[]) => void | Promise<unknown> }
): { isDraggingOver: Readonly<Ref<boolean>> } {
  const isDraggingOver = ref(false)
  let cleanup = () => {}

  onMounted(() => {
    const element = toValue(dropTargetElement)
    if (!element) return

    cleanup = dropTargetForExternal({
      element,
      canDrop: containsFiles,
      onDragEnter: () => {
        isDraggingOver.value = true
      },
      onDragLeave: () => {
        isDraggingOver.value = false
      },
      onDrop: ({ source }) => {
        isDraggingOver.value = false
        const files = getFiles({ source })
        if (files.length) {
          void Promise.resolve(options.onDrop(files)).catch((e) => {
            console.error('External file drop handler failed', e)
          })
        }
      }
    })
  })

  onBeforeUnmount(() => {
    cleanup()
  })

  return { isDraggingOver: readonly(isDraggingOver) }
}
