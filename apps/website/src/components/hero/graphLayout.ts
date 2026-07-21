export type ElementKey = 'input' | 'angle' | 'output'

export interface ElementRect {
  left: number
  top: number
  width: number
  height: number
}

/** Layout in em units; the canvas scales the em size to fit its container. */
export const FLOW: {
  canvas: { width: number; height: number }
  elements: Record<ElementKey, ElementRect>
} = {
  canvas: { width: 95, height: 34 },
  elements: {
    input: { left: 0, top: 9, width: 30, height: 16.4 },
    angle: { left: 37.5, top: 3, width: 20, height: 20 },
    output: { left: 65, top: 9, width: 30, height: 16.4 }
  }
}

export const ELEMENT_KEYS: ElementKey[] = ['input', 'angle', 'output']

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
  inputOut: { el: 'input', dx: 30, dy: 8.2 },
  angleIn: { el: 'angle', dx: 1.3, dy: 1.125 },
  angleOut: { el: 'angle', dx: 18.7, dy: 1.125 },
  outputIn: { el: 'output', dx: 0.9, dy: 2.9 }
}

export function portPoint(
  port: Port,
  positions: Record<ElementKey, { x: number; y: number }>
): { x: number; y: number } {
  const pos = positions[port.el]
  return { x: pos.x + port.dx, y: pos.y + port.dy }
}
