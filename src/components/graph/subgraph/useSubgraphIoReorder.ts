import { useEventListener } from '@vueuse/core'
import { clamp } from 'es-toolkit'
import { computed, shallowRef } from 'vue'
import type { CSSProperties, Ref } from 'vue'

const DRAG_THRESHOLD_PX = 4
const REORDER_STEPS: Partial<Record<string, number>> = {
  ArrowUp: -1,
  ArrowDown: 1
}

interface Section {
  first: number
  last: number
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
  section: Section
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

function sectionOffset({ rows, from, section, offset }: ReorderDrag): number {
  const dragged = rows[from]
  const first = rows[section.first]
  const last = rows[section.last]
  return clamp(
    offset,
    first.top - dragged.top,
    last.top + last.height - dragged.top - dragged.height
  )
}

/** Drag and Alt + arrow key reordering for the rows of a subgraph IO panel, each kept within its section. */
export function useSubgraphIoReorder(
  rowElements: () => readonly HTMLElement[],
  panel: Readonly<Ref<HTMLElement | null>>,
  sectionOf: (index: number) => Section,
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
      })),
      section: sectionOf(index)
    }
  }

  function moveDrag(event: PointerEvent) {
    const current = drag.value
    if (current?.pointerId !== event.pointerId) return
    const delta = event.clientY - current.startY
    if (!current.moved && Math.abs(delta) < DRAG_THRESHOLD_PX) return
    const offset = delta / current.scale
    const { first, last } = current.section
    drag.value = {
      ...current,
      moved: true,
      offset,
      to: clamp(dropIndex(current.rows, current.from, offset), first, last)
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

  function stepWithKeyboard(event: KeyboardEvent, index: number): boolean {
    const step = event.altKey ? REORDER_STEPS[event.key] : undefined
    if (step === undefined) return false
    event.preventDefault()
    event.stopPropagation()
    const target = index + step
    const { first, last } = sectionOf(index)
    if (drag.value || target < first || target > last) return false
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
      index === current.from ? sectionOffset(current) : shiftOf(current, index)
    return offset ? { transform: `translateY(${offset}px)` } : undefined
  }

  function cancelDrag() {
    drag.value = undefined
  }

  return { draggingIndex, rowStyle, startDrag, stepWithKeyboard, cancelDrag }
}
