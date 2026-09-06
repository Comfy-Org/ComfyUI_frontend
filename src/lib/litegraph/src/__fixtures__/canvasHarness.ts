import { vi } from 'vitest'

import type { Rect } from '@/lib/litegraph/src/interfaces'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import {
  LGraphCanvas,
  LGraphGroup,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

export type Modifiers = Partial<
  Pick<MouseEventInit, 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey'>
>

export type PointerEventOptions = Modifiers & {
  button?: number
  timeStamp?: number
}

export type PointerEventType =
  | 'pointerdown'
  | 'pointermove'
  | 'pointerup'
  | 'pointercancel'

export function createCanvas(graph: LGraph): LGraphCanvas {
  const canvasElement = document.createElement('canvas')
  canvasElement.width = 800
  canvasElement.height = 600
  canvasElement.getContext = vi
    .fn()
    .mockReturnValue(createMockCanvasRenderingContext2D())
  canvasElement.getBoundingClientRect = vi.fn().mockReturnValue({
    left: 0,
    top: 0,
    width: 800,
    height: 600
  })
  document.body.append(canvasElement)
  return new LGraphCanvas(canvasElement, graph, { skip_render: true })
}

export function addNode(graph: LGraph, title: string, x: number, y: number) {
  const node = new LGraphNode(title)
  node.pos = [x, y]
  node.size = [100, 60]
  node.updateArea()
  graph.add(node)
  return node
}

export function addGroup(graph: LGraph, title: string, bounds: Rect) {
  const group = new LGraphGroup(title)
  group._bounding.set(bounds)
  graph.add(group)
  return group
}

export function pointerEvent(
  type: PointerEventType,
  x: number,
  y: number,
  { button = 0, timeStamp, ...modifiers }: PointerEventOptions = {}
): PointerEvent {
  const pressed = type === 'pointerdown' || type === 'pointermove'
  const event = new MouseEvent(type, {
    button,
    buttons: pressed ? (button === 2 ? 2 : 1) : 0,
    clientX: x,
    clientY: y,
    ...modifiers
  })
  Object.defineProperty(event, 'isPrimary', { value: true })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  if (timeStamp !== undefined) {
    Object.defineProperty(event, 'timeStamp', { value: timeStamp })
  }
  return event as PointerEvent
}

export function keyEvent(
  type: 'keydown' | 'keyup',
  key: string
): KeyboardEvent {
  const event = new KeyboardEvent(type, { key })
  Object.defineProperty(event, 'target', { value: { localName: 'div' } })
  return event
}

export function selectedTitles(canvas: LGraphCanvas): string[] {
  return [...canvas.selectedItems]
    .map((item) => ('title' in item ? String(item.title) : String(item)))
    .sort()
}
