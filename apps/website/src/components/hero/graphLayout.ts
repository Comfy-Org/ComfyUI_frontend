export type ElementKey = 'input' | 'angle' | 'output'

export interface ElementRect {
  left: number
  top: number
  width: number
  height: number
}

/** Layout in em units; the canvas scales the em size to fit its container.
 * The output card intentionally extends past the canvas so it bleeds off the
 * right edge of the viewport. */
export const FLOW: {
  canvas: { width: number; height: number }
  elements: Record<ElementKey, ElementRect>
} = {
  canvas: { width: 95, height: 42 },
  elements: {
    input: { left: 0, top: 5.3, width: 19, height: 10.3 },
    angle: { left: 26, top: 21, width: 20, height: 20 },
    output: { left: 67, top: 4, width: 49, height: 26.5 }
  }
}

export const ELEMENT_KEYS: ElementKey[] = ['input', 'angle', 'output']

/** Minimum width (em) of a card that must stay inside the canvas when dragged. */
export const DRAG_MARGIN = 8

interface Port {
  el: ElementKey
  dx: number
  dy: number
}

/** Port offsets relative to each element's top-left corner (em). */
export const PORTS: Record<
  'inputOut' | 'angleIn' | 'angleOut' | 'outputIn',
  Port
> = {
  inputOut: { el: 'input', dx: 17.5, dy: 1.6 },
  angleIn: { el: 'angle', dx: 1.3, dy: 1.125 },
  angleOut: { el: 'angle', dx: 18.7, dy: 1.125 },
  outputIn: { el: 'output', dx: 2.15, dy: 2 }
}

export function portPoint(
  port: Port,
  positions: Record<ElementKey, { x: number; y: number }>
): { x: number; y: number } {
  const pos = positions[port.el]
  return { x: pos.x + port.dx, y: pos.y + port.dy }
}
