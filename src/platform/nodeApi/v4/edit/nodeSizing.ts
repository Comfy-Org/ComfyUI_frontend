import { clamp } from 'es-toolkit'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { checkedFields } from '@/platform/nodeApi/v4/checkedFields'
import type { SizeConstraints } from '@/platform/nodeApi/v4/types'
import { checkedBoolean, checkedNonNegative } from './checkedArguments'

const CONSTRAINTS = {
  minWidth: true,
  minHeight: true,
  maxWidth: true,
  maxHeight: true,
  autoHeight: true
} satisfies Record<keyof SizeConstraints, true>

type Limit = Exclude<keyof SizeConstraints, 'autoHeight'>

export function checkedSizeConstraints(
  member: string,
  value: unknown
): SizeConstraints {
  const given = checkedFields(member, 'sizeConstraints', value, CONSTRAINTS)
  const limit = (field: Limit) =>
    given[field] === undefined
      ? undefined
      : checkedNonNegative(member, `sizeConstraints.${field}`, given[field])
  const constraints = {
    minWidth: limit('minWidth'),
    minHeight: limit('minHeight'),
    maxWidth: limit('maxWidth'),
    maxHeight: limit('maxHeight'),
    autoHeight:
      given.autoHeight === undefined
        ? undefined
        : checkedBoolean(member, 'sizeConstraints.autoHeight', given.autoHeight)
  }
  assertOrdered(member, 'Width', constraints.minWidth, constraints.maxWidth)
  assertOrdered(member, 'Height', constraints.minHeight, constraints.maxHeight)
  return constraints
}

function assertOrdered(
  member: string,
  dimension: string,
  min: number | undefined,
  max: number | undefined
): void {
  if (min !== undefined && max !== undefined && min > max) {
    throw invalidArgument(
      member,
      `sizeConstraints.min${dimension} no larger than max${dimension}`,
      min
    )
  }
}

/** Sizes the node to the constraints once. A later resize is not held to them. */
export function fitToConstraints(
  node: LGraphNode,
  { minWidth, minHeight, maxWidth, maxHeight, autoHeight }: SizeConstraints
): void {
  const [width, height] = node.size
  const wantedHeight = autoHeight ? node.computeSize()[1] : height
  const fitted: [number, number] = [
    clamp(width, minWidth ?? 0, maxWidth ?? Infinity),
    clamp(wantedHeight, minHeight ?? 0, maxHeight ?? Infinity)
  ]
  if (fitted[0] !== width || fitted[1] !== height) node.setSize(fitted)
}

/** Sets whether the user may resize `node`. Pinning stops it, and unpinning makes the node resizable again. */
export function chooseResizable(
  node: LGraphNode,
  { resizable }: { resizable: boolean }
): void {
  node.resizable = resizable && !node.pinned
}
