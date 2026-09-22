import * as Y from 'yjs'

import { linksMap } from '@comfyorg/comfy-multi-player'

/** Reads a doc link's raw Yjs tuple as a plain array, or null if it isn't one. */
export function readLinkTuple(
  doc: Y.Doc,
  id: string
): readonly unknown[] | null {
  const raw = linksMap(doc).get(id)
  const tuple = raw instanceof Y.Array ? raw.toArray() : raw
  return Array.isArray(tuple) ? tuple : null
}

/**
 * Element 5 of a link tuple is its wire type. Anything that hasn't landed as
 * a string or number normalizes to the wildcard `'*'`, matching the doc's
 * own untyped-link convention.
 */
export function linkWireType(tuple: readonly unknown[]): string | number {
  const raw = tuple[5]
  return typeof raw === 'string' || typeof raw === 'number' ? raw : '*'
}

function isIdValue(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number'
}

/** A link tuple's connect-relevant fields, schema-validated. */
export interface ValidatedLinkEndpoints {
  readonly originId: string
  readonly originSlot: number
  readonly targetId: string
  readonly targetSlot: number
  readonly type: string | number
}

/**
 * Parses a raw link tuple's endpoints for delivery-proof comparison. Unlike a
 * bare array index, this REJECTS a slot that hasn't landed as an actual
 * `number` (e.g. the string `"0"`) instead of letting `Number("0") === 0`
 * coerce it into a false match — a schema-invalid tuple must not be able to
 * prove a `connect`'s effect is present.
 */
export function validateLinkEndpoints(
  tuple: readonly unknown[]
): ValidatedLinkEndpoints | null {
  const originId = tuple[1]
  const originSlot = tuple[2]
  const targetId = tuple[3]
  const targetSlot = tuple[4]
  if (
    !isIdValue(originId) ||
    typeof originSlot !== 'number' ||
    !isIdValue(targetId) ||
    typeof targetSlot !== 'number'
  )
    return null
  return {
    originId: String(originId),
    originSlot,
    targetId: String(targetId),
    targetSlot,
    type: linkWireType(tuple)
  }
}
