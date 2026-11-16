import { useEventListener } from '@vueuse/core'
import { computed, shallowRef } from 'vue'
import type { CSSProperties, Ref } from 'vue'

const DRAG_THRESHOLD_PX = 4
const REORDER_STEPS: Partial<Record<string, number>> = {
  ArrowUp: -1,
  ArrowDown: 1
}

interface RowBox {
  top: number
  height: number
}

interface ReorderDrag {
  pointerId: number
  from: number
  to: number
  startY: number
  scale: number
  offset: number
  moved: boolean
  rows: readonly RowBox[]
}

function dropIndex(rows: readonly RowBox[], from: number, offset: number) {
  const dragged = rows[from]
  const center = dragged.top + offset + dragged.height / 2
  return rows.filter(
    (row, index) => index !== from && row.top + row.height / 2 < center
  ).length
}

function shiftOf(drag: ReorderDrag, index: number): number {
  const { from, to, rows } = drag
  const gap = rows.length > 1 ? rows[1].top - rows[0].top - rows[0].height : 0
  const span = rows[from].height + gap
  if (from < to && index > from && index <= to) return -span
  if (to < from && index >= to && index < from) return span
  return 0
}

/** Drag and Alt + arrow key reordering for the rows of a subgraph IO panel. */
export function useSubgraphIoReorder(
  rowElements: () => readonly HTMLElement[],
  panel: Readonly<Ref<HTMLElement | null>>,
  onReorder: (from: number, to: number) => void
) {
  const drag = shallowRef<ReorderDrag>()

  function startDrag(event: PointerEvent, index: number) {
    const element = panel.value
    if (event.button !== 0 || !element?.offsetHeight) return
    event.preventDefault()
    if (event.currentTarget instanceof Element)
      event.currentTarget.setPointerCapture(event.pointerId)
    drag.value = {
      pointerId: event.pointerId,
      from: index,
      to: index,
      startY: event.clientY,
      scale: element.getBoundingClientRect().height / element.offsetHeight,
      offset: 0,
      moved: false,
      rows: rowElements().map((row) => ({
        top: row.offsetTop,
        height: row.offsetHeight
      }))
    }
  }

  function moveDrag(event: PointerEvent) {
    const current = drag.value
    if (current?.pointerId !== event.pointerId) return
    const delta = event.clientY - current.startY
    if (!current.moved && Math.abs(delta) < DRAG_THRESHOLD_PX) return
    const offset = delta / current.scale
    drag.value = {
      ...current,
      moved: true,
      offset,
      to: dropIndex(current.rows, current.from, offset)
    }
  }

  function endDrag(event: PointerEvent) {
    const current = drag.value
    if (current?.pointerId !== event.pointerId) return
    drag.value = undefined
    if (event.type === 'pointerup' && current.from !== current.to)
      onReorder(current.from, current.to)
  }

  useEventListener(window, 'pointermove', moveDrag, { capture: true })
  useEventListener(window, ['pointerup', 'pointercancel'], endDrag, {
    capture: true
  })

  function stepWithKeyboard(
    event: KeyboardEvent,
    index: number,
    count: number
  ): boolean {
    const step = event.altKey ? REORDER_STEPS[event.key] : undefined
    if (step === undefined) return false
    event.preventDefault()
    event.stopPropagation()
    const target = index + step
    if (drag.value || target < 0 || target >= count) return false
    onReorder(index, target)
    return true
  }

  const draggingIndex = computed(() =>
    drag.value?.moved ? drag.value.from : undefined
  )

  function rowStyle(index: number): CSSProperties | undefined {
    const current = drag.value
    if (!current?.moved) return undefined
    const offset =
      index === current.from ? current.offset : shiftOf(current, index)
    return offset ? { transform: `translateY(${offset}px)` } : undefined
  }

  return { draggingIndex, rowStyle, startDrag, stepWithKeyboard }
}
