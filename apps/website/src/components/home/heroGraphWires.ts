export type NodeId = 'image' | 'texture' | 'color' | 'lighting' | 'output'

export interface Point {
  x: number
  y: number
}

export interface Rect extends Point {
  w: number
  h: number
}

export interface Wire {
  d: string
  from: Point
  to: Point
}

type Axis = 'h' | 'v'
type Port = (r: Rect) => Point

const rightPort =
  (f = 0.5): Port =>
  (r) => ({ x: r.x + r.w, y: r.y + r.h * f })
const leftPort =
  (f = 0.5): Port =>
  (r) => ({ x: r.x, y: r.y + r.h * f })
const bottomPort =
  (f = 0.5): Port =>
  (r) => ({ x: r.x + r.w * f, y: r.y + r.h })
const topPort =
  (f = 0.5): Port =>
  (r) => ({ x: r.x + r.w * f, y: r.y })
// Enters the left edge at a fixed offset from the top, so a wire can point at
// an element pinned inside the node (e.g. the OUTPUT pills) regardless of the
// node's measured height.
const leftPortAtY =
  (y: number): Port =>
  (r) => ({ x: r.x, y: r.y + y })

// Vertical centers of the OUTPUT card's stacked COLOR / LIGHTING pills
// (top-4 inset, ~29px pill, gap-2), in design coordinates.
const OUTPUT_PILL_Y = { color: 31, lighting: 68 }

function clampOffset(d: number): number {
  return Math.min(Math.max(Math.abs(d) * 0.5, 55), 120)
}

// Soft cubic whose tangents follow the connected ports: side ports (right→left)
// depart horizontally, stacked ports (bottom→top) depart vertically. Keeping the
// tangent on the port axis stops a wire between side ports from reading as a
// top-down drop when the vertical gap happens to exceed the horizontal one.
export function spline(s: Point, e: Point, axis: Axis): string {
  if (axis === 'h') {
    const off = Math.sign(e.x - s.x || 1) * clampOffset(e.x - s.x)
    return `M ${s.x} ${s.y} C ${s.x + off} ${s.y} ${e.x - off} ${e.y} ${e.x} ${e.y}`
  }
  const off = Math.sign(e.y - s.y || 1) * clampOffset(e.y - s.y)
  return `M ${s.x} ${s.y} C ${s.x} ${s.y + off} ${e.x} ${e.y - off} ${e.x} ${e.y}`
}

interface Connection {
  from: NodeId
  to: NodeId
  fromPort: Port
  toPort: Port
  axis: Axis
}

export const connections: Connection[] = [
  {
    from: 'image',
    to: 'texture',
    fromPort: bottomPort(0.4),
    toPort: topPort(0.5),
    axis: 'v'
  },
  {
    from: 'texture',
    to: 'color',
    fromPort: rightPort(0.35),
    toPort: leftPort(0.5),
    axis: 'h'
  },
  {
    from: 'texture',
    to: 'lighting',
    fromPort: rightPort(0.7),
    toPort: leftPort(0.6),
    axis: 'h'
  },
  {
    from: 'color',
    to: 'output',
    fromPort: rightPort(0.3),
    toPort: leftPortAtY(OUTPUT_PILL_Y.color),
    axis: 'h'
  },
  {
    from: 'lighting',
    to: 'output',
    fromPort: rightPort(0.4),
    toPort: leftPortAtY(OUTPUT_PILL_Y.lighting),
    axis: 'h'
  }
]

export function computeWires(anchors: Partial<Record<NodeId, Rect>>): Wire[] {
  return connections.flatMap((c) => {
    const fr = anchors[c.from]
    const to = anchors[c.to]
    if (!fr || !to) return []
    const from = c.fromPort(fr)
    const dest = c.toPort(to)
    return [
      {
        from,
        to: dest,
        d: spline(from, dest, c.axis)
      }
    ]
  })
}
