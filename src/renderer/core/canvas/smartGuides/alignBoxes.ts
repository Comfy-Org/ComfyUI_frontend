import type { SnapBox } from '@/lib/litegraph/src/canvas/gestureSnap'

import { orderAlong, spaceEvenly } from './distributeGaps'
import type { DistributeAxis } from './distributeGaps'

export type AlignAction =
  | 'left'
  | 'center'
  | 'right'
  | 'top'
  | 'middle'
  | 'bottom'
  | 'matchWidth'
  | 'matchHeight'
  | 'distributeX'
  | 'distributeY'

const bodyHeight = (b: SnapBox) => b.height - b.head

function distribute(boxes: SnapBox[], axis: DistributeAxis): SnapBox[] {
  if (boxes.length < 3) return boxes
  const order = orderAlong(boxes, axis)
  const ordered = order.map(({ box }) => box)
  const first = ordered[0]
  const last = ordered[ordered.length - 1]
  const size = (b: SnapBox) => (axis === 'x' ? b.width : b.height)
  const span = last[axis] + size(last) - first[axis]
  const total = boxes.reduce((sum, b) => sum + size(b), 0)
  const spaced = spaceEvenly(ordered, axis, (span - total) / (boxes.length - 1))

  const result = [...boxes]
  order.forEach(({ index }, i) => (result[index] = spaced[i]))
  return result
}

/** Aligns, sizes, or distributes boxes; returns them in the same order. */
export function alignBoxes(boxes: SnapBox[], action: AlignAction): SnapBox[] {
  if (boxes.length < 2) return boxes
  const minX = Math.min(...boxes.map((b) => b.x))
  const maxRight = Math.max(...boxes.map((b) => b.x + b.width))
  const minY = Math.min(...boxes.map((b) => b.y))
  const maxBottom = Math.max(...boxes.map((b) => b.y + b.height))
  const minBodyTop = Math.min(...boxes.map((b) => b.y + b.head))

  switch (action) {
    case 'left':
      return boxes.map((b) => ({ ...b, x: minX }))
    case 'center':
      return boxes.map((b) => ({ ...b, x: (minX + maxRight - b.width) / 2 }))
    case 'right':
      return boxes.map((b) => ({ ...b, x: maxRight - b.width }))
    case 'top':
      return boxes.map((b) => ({ ...b, y: minBodyTop - b.head }))
    case 'middle':
      return boxes.map((b) => ({ ...b, y: (minY + maxBottom - b.height) / 2 }))
    case 'bottom':
      return boxes.map((b) => ({ ...b, y: maxBottom - b.height }))
    case 'matchWidth': {
      const width = Math.max(...boxes.map((b) => b.width))
      return boxes.map((b) => ({ ...b, width }))
    }
    case 'matchHeight': {
      const body = Math.max(...boxes.map(bodyHeight))
      return boxes.map((b) => ({ ...b, height: body + b.head }))
    }
    case 'distributeX':
      return distribute(boxes, 'x')
    case 'distributeY':
      return distribute(boxes, 'y')
  }
}
