import { LinkDirection, RenderShape } from '@comfyorg/graph-model/globalEnums'

import type { SlotDirection, SlotShape } from '@/platform/nodeApi/v4/types'

/** The shape the host draws for each name; `'default'` is the host's own choice. */
export const SLOT_SHAPES: Readonly<Record<SlotShape, RenderShape | undefined>> =
  {
    default: undefined,
    optional: RenderShape.HollowCircle,
    list: RenderShape.GRID,
    directional: RenderShape.ARROW
  }

export const SLOT_DIRECTIONS: Readonly<Record<SlotDirection, LinkDirection>> = {
  none: LinkDirection.NONE,
  up: LinkDirection.UP,
  down: LinkDirection.DOWN,
  left: LinkDirection.LEFT,
  right: LinkDirection.RIGHT,
  center: LinkDirection.CENTER
}

export function slotShapeName(shape: RenderShape | undefined): SlotShape {
  return nameOf(SLOT_SHAPES, shape) ?? 'default'
}

export function slotDirectionName(
  direction: LinkDirection | undefined
): SlotDirection | undefined {
  return direction === undefined
    ? undefined
    : nameOf(SLOT_DIRECTIONS, direction)
}

function nameOf<TName extends string, TValue>(
  table: Readonly<Record<TName, TValue>>,
  value: TValue
): TName | undefined {
  return Object.keys(table)
    .filter((name): name is TName => Object.hasOwn(table, name))
    .find((name) => table[name] === value)
}
