import { useEventListener } from '@vueuse/core'
import { ref } from 'vue'
import type { Ref } from 'vue'

import { dropIndex } from '@/composables/videoConcat/videoConcatOrder'

const DRAG_THRESHOLD_PX = 4

interface ClipStripReorderOptions {
  stripRef: Readonly<Ref<HTMLElement | null>>
  tileSelector: string
  onReorder: (from: number, to: number) => void
  onSelect: (index: number) => void
}

interface DragGhost {
  left: number
  top: number
  width: number
  height: number
}

export function useClipStripReorder({
  stripRef,
  tileSelector,
  onReorder,
  onSelect
}: ClipStripReorderOptions) {
  const dragFrom = ref<number>()
  const dragTo = ref<number>()
  const ghost = ref<DragGhost>()
  let start = { x: 0, y: 0 }
  let grab = { x: 0, y: 0, width: 0, height: 0 }
  let moved = false

  function tileCenters(): number[] {
    const tiles = stripRef.value?.querySelectorAll(tileSelector) ?? []
    return Array.from(tiles, (tile) => {
      const rect = tile.getBoundingClientRect()
      return rect.left + rect.width / 2
    })
  }

  function handlePointerDown(event: PointerEvent, index: number) {
    if (event.button !== 0) return
    const rect =
      event.currentTarget instanceof Element
        ? event.currentTarget.getBoundingClientRect()
        : new DOMRect(event.clientX, event.clientY)
    dragFrom.value = index
    dragTo.value = index
    start = { x: event.clientX, y: event.clientY }
    grab = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      width: rect.width,
      height: rect.height
    }
    moved = false
  }

  function handlePointerMove(event: PointerEvent) {
    if (dragTo.value === undefined) return
    if (!moved && Math.abs(event.clientX - start.x) < DRAG_THRESHOLD_PX) return
    moved = true
    ghost.value = {
      left: event.clientX - grab.x,
      top: event.clientY - grab.y,
      width: grab.width,
      height: grab.height
    }
    dragTo.value = dropIndex(event.clientX, tileCenters(), dragTo.value)
  }

  function endDrag() {
    dragFrom.value = undefined
    dragTo.value = undefined
    ghost.value = undefined
  }

  function finishDrag() {
    const from = dragFrom.value
    const to = dragTo.value
    endDrag()
    if (from === undefined || to === undefined) return
    if (!moved) onSelect(from)
    else if (from !== to) onReorder(from, to)
  }

  useEventListener(window, 'pointermove', handlePointerMove, { capture: true })
  useEventListener(window, 'pointerup', finishDrag, { capture: true })
  useEventListener(window, 'pointercancel', endDrag, { capture: true })

  return { dragFrom, dragTo, ghost, handlePointerDown }
}
