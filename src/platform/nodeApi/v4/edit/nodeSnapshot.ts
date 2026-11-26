import { RenderShape } from '@comfyorg/graph-model/globalEnums'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

import { MODE_NAMES } from '@/platform/nodeApi/v4/nodeHandle'
import type { NodeShape, NodeSnapshot } from '@/platform/nodeApi/v4/types'

/** The node's state at this moment, frozen. */
export function snapshotOf(node: LGraphNode): NodeSnapshot {
  const [x, y] = node.pos
  const [width, height] = node.size
  return Object.freeze({
    id: node.id,
    type: node.type,
    title: textOrUndefined(node.title),
    mode: MODE_NAMES.get(node.mode),
    collapsed: node.collapsed,
    pinned: node.pinned,
    color: textOrUndefined(node.color),
    bgColor: textOrUndefined(node.bgcolor),
    shape: shapeName(node.shape),
    position: Object.freeze({ x, y }),
    size: Object.freeze({ width, height })
  })
}

const SHAPE_NAMES: Readonly<Partial<Record<RenderShape, NodeShape>>> = {
  [RenderShape.BOX]: 'box',
  [RenderShape.ROUND]: 'round',
  [RenderShape.CIRCLE]: 'circle',
  [RenderShape.CARD]: 'card'
}

function shapeName(shape: RenderShape | undefined): NodeShape {
  return (shape === undefined ? undefined : SHAPE_NAMES[shape]) ?? 'default'
}

function textOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}
