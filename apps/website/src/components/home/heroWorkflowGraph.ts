import { clamp } from 'es-toolkit'

import type { TranslationKey } from '../../i18n/translations'

export type WorkflowNodeId =
  | 'model'
  | 'clip'
  | 'vae'
  | 'lora'
  | 'seed'
  | 'output'

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
  color: string
}

export interface NodeWidget {
  name: string
  value: string
  kind: 'combo' | 'number' | 'text'
}

export const STAGE_W = 1600
export const STAGE_H = 780

export const NODE_W: Record<WorkflowNodeId, number> = {
  model: 300,
  clip: 300,
  vae: 300,
  lora: 320,
  seed: 280,
  output: 460
}

// Loaders stack on the left, the LoRA + seed chain runs under the centred
// headline, and the Save Image node sits fully inside the right edge so
// nothing bleeds offscreen.
export const homePositions: Record<WorkflowNodeId, Point> = {
  model: { x: 24, y: 70 },
  clip: { x: 24, y: 280 },
  vae: { x: 24, y: 490 },
  lora: { x: 420, y: 470 },
  seed: { x: 790, y: 520 },
  output: { x: 1090, y: 48 }
}

export const NODE_TITLE_KEYS = {
  model: 'hero.node.model',
  clip: 'hero.node.clip',
  vae: 'hero.node.vae',
  lora: 'hero.node.lora',
  seed: 'hero.node.seed',
  output: 'hero.node.output'
} as const satisfies Record<WorkflowNodeId, TranslationKey>

export const nodeWidgets: Partial<Record<WorkflowNodeId, NodeWidget[]>> = {
  model: [
    { name: 'unet_name', value: 'krea2_turbo_fp8_scaled', kind: 'combo' }
  ],
  clip: [{ name: 'clip_name', value: 'qwen3vl_4b_fp8_scaled', kind: 'combo' }],
  vae: [{ name: 'vae_name', value: 'qwen_image_vae', kind: 'combo' }],
  lora: [
    { name: 'lora_name', value: 'krea2_darkbrush', kind: 'combo' },
    { name: 'strength_model', value: '0.80', kind: 'number' }
  ]
}

// Litegraph slot colors, so the wiring reads as the real ComfyUI canvas.
const WIRE_COLORS = {
  model: '#b39ddb',
  clip: '#ffd500',
  vae: '#ff6e6e',
  int: '#6a8bad'
} as const

type Axis = 'h' | 'v'
type Port = (r: Rect) => Point

const rightPort =
  (f = 0.5): Port =>
  (r) => ({ x: r.x + r.w, y: r.y + r.h * f })
const leftPort =
  (f = 0.5): Port =>
  (r) => ({ x: r.x, y: r.y + r.h * f })

function clampOffset(d: number): number {
  return Math.min(Math.max(Math.abs(d) * 0.5, 55), 120)
}

// Soft cubic whose tangents follow the connected ports, so a wire between side
// ports departs horizontally even when the vertical gap dominates.
export function spline(s: Point, e: Point, axis: Axis): string {
  if (axis === 'h') {
    const off = Math.sign(e.x - s.x || 1) * clampOffset(e.x - s.x)
    return `M ${s.x} ${s.y} C ${s.x + off} ${s.y} ${e.x - off} ${e.y} ${e.x} ${e.y}`
  }
  const off = Math.sign(e.y - s.y || 1) * clampOffset(e.y - s.y)
  return `M ${s.x} ${s.y} C ${s.x} ${s.y + off} ${e.x} ${e.y - off} ${e.x} ${e.y}`
}

interface Connection {
  from: WorkflowNodeId
  to: WorkflowNodeId
  fromPort: Port
  toPort: Port
  axis: Axis
  color: string
}

export const connections: Connection[] = [
  {
    from: 'model',
    to: 'lora',
    fromPort: rightPort(0.7),
    toPort: leftPort(0.35),
    axis: 'h',
    color: WIRE_COLORS.model
  },
  {
    from: 'clip',
    to: 'lora',
    fromPort: rightPort(0.7),
    toPort: leftPort(0.6),
    axis: 'h',
    color: WIRE_COLORS.clip
  },
  {
    from: 'lora',
    to: 'output',
    fromPort: rightPort(0.4),
    toPort: leftPort(0.14),
    axis: 'h',
    color: WIRE_COLORS.model
  },
  {
    from: 'seed',
    to: 'output',
    fromPort: rightPort(0.45),
    toPort: leftPort(0.19),
    axis: 'h',
    color: WIRE_COLORS.int
  },
  {
    from: 'vae',
    to: 'output',
    fromPort: rightPort(0.7),
    toPort: leftPort(0.24),
    axis: 'h',
    color: WIRE_COLORS.vae
  }
]

export function computeWires(
  anchors: Partial<Record<WorkflowNodeId, Rect>>
): Wire[] {
  return connections.flatMap((c) => {
    const fr = anchors[c.from]
    const to = anchors[c.to]
    if (!fr || !to) return []
    const from = c.fromPort(fr)
    const dest = c.toPort(to)
    return [{ from, to: dest, color: c.color, d: spline(from, dest, c.axis) }]
  })
}

// Drags are confined to the stage rect so every node stops at the edge
// instead of getting cut off.
export function clampNodePosition(
  id: WorkflowNodeId,
  point: Point,
  height: number
): Point {
  return {
    x: clamp(point.x, 0, STAGE_W - NODE_W[id]),
    y: clamp(point.y, 0, STAGE_H - height)
  }
}
