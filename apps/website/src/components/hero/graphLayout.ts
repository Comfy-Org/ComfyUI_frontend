import { mapValues } from 'es-toolkit'

export type ElementKey = 'input' | 'angle' | 'color' | 'output'

export interface ElementRect {
  left: number
  top: number
  width: number
  height: number
}

const input: ElementRect = { left: 0, top: 4.5, width: 16, height: 12 }
const angle: ElementRect = { left: 21.5, top: 10, width: 18, height: 18 }
const color: ElementRect = { left: 45.5, top: 19, width: 14, height: 9 }
const output: ElementRect = { left: 65, top: 1, width: 42, height: 31.5 }

/** Layout in em units; the canvas scales the em size to fit its container.
 * The output card intentionally extends past the canvas so it bleeds off the
 * right edge of the viewport. */
export const FLOW: {
  canvas: { width: number; height: number }
  elements: Record<ElementKey, ElementRect>
} = {
  canvas: { width: 95, height: 32.5 },
  elements: { input, angle, color, output }
}

/** Centre of the clear band between the input and output cards. */
export const COLUMN_CENTER = (input.left + input.width + output.left) / 2

/** Vertical slot (em) of the CTA under the control nodes. */
export const CTA = { top: angle.top + angle.height + 2, height: 2.5 }

export const ELEMENT_KEYS: ElementKey[] = ['input', 'angle', 'color', 'output']

/** Minimum width (em) of a card that must stay inside the canvas when dragged. */
export const DRAG_MARGIN = 8

export function defaultPositions(): Record<
  ElementKey,
  { x: number; y: number }
> {
  return mapValues(FLOW.elements, ({ left, top }) => ({ x: left, y: top }))
}

interface Port {
  el: ElementKey
  side: 'left' | 'right'
  dx: number
  dy: number
}

const HEADER_DOT_INSET = 1.325

const INPUT_DOT_INSET = 1.5

/** Port offsets (em) from each element's top-left corner, at the centre of
 * its DOM dot. */
export const PORTS: Record<
  'inputOut' | 'angleIn' | 'angleOut' | 'colorIn' | 'colorOut' | 'outputIn',
  Port
> = {
  inputOut: {
    el: 'input',
    side: 'right',
    dx: input.width - INPUT_DOT_INSET,
    dy: 1.6
  },
  angleIn: { el: 'angle', side: 'left', dx: HEADER_DOT_INSET, dy: 1.125 },
  angleOut: {
    el: 'angle',
    side: 'right',
    dx: angle.width - HEADER_DOT_INSET,
    dy: 1.125
  },
  colorIn: { el: 'color', side: 'left', dx: HEADER_DOT_INSET, dy: 1.125 },
  colorOut: {
    el: 'color',
    side: 'right',
    dx: color.width - HEADER_DOT_INSET,
    dy: 1.125
  },
  outputIn: { el: 'output', side: 'left', dx: 2.15, dy: 2 }
}

export function portPoint(
  port: Port,
  positions: Record<ElementKey, { x: number; y: number }>
): { x: number; y: number } {
  const pos = positions[port.el]
  return { x: pos.x + port.dx, y: pos.y + port.dy }
}

/** Where a wire crosses the edge of the port's element, level with its dot. */
export function portEdge(
  port: Port,
  positions: Record<ElementKey, { x: number; y: number }>
): { x: number; y: number } {
  const pos = positions[port.el]
  const x = port.side === 'left' ? pos.x : pos.x + FLOW.elements[port.el].width
  return { x, y: pos.y + port.dy }
}
