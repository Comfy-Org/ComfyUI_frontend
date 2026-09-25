import * as Y from 'yjs'

import { linksMap } from '@comfyorg/comfy-multi-player'

import { parseLinkId } from '@/types/linkId'

/** Reads a doc link's raw Yjs tuple as a plain array, or null if it isn't one. */
export function readLinkTuple(
  doc: Y.Doc,
  id: string
): readonly unknown[] | null {
  const raw = linksMap(doc).get(id)
  const tuple = raw instanceof Y.Array ? raw.toArray() : raw
  return Array.isArray(tuple) ? tuple : null
}

/** A link tuple's own id (element 0), narrowed to a real non-negative safe integer. */
export function resolveLinkId(raw: unknown): number | null {
  return typeof raw === 'number' && raw >= 0 && Number.isSafeInteger(raw)
    ? raw
    : null
}

/**
 * A link's doc map key, narrowed to the same id space as {@link resolveLinkId}.
 * `insert_workflow` mints a derived, non-numeric doc id for some inserted
 * entities; a link whose map key doesn't parse as a real link id can never
 * match its tuple's own id and is retired rather than materialized.
 */
export function resolveLinkMapKey(id: string): number | null {
  const linkId = parseLinkId(id)
  return linkId !== undefined && linkId >= 0 ? linkId : null
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
  readonly type: string
}

/**
 * Parses a raw link tuple's endpoints for delivery-proof comparison. The
 * applier only ever writes a link tuple's 6 elements together (`connect`
 * rejects a non-string `link_type` before mset), so a tuple missing element 5
 * is a PARTIALLY LANDED write, never a deliberately untyped link — unlike
 * {@link linkWireType}'s display fallback, this must not coerce that absence
 * to the wildcard `'*'` and let an incomplete tuple pass as delivery
 * evidence for a wildcard `connect`. Slots are further rejected unless they
 * are actual integers: a bare `typeof === 'number'` check would still let a
 * fractional or non-finite value (e.g. `NaN`, `Infinity`) through, and
 * `parseLinkScalarFields` (the incremental path's equivalent) holds
 * `connect` to the same integer constraint.
 */
export function validateLinkEndpoints(
  tuple: readonly unknown[]
): ValidatedLinkEndpoints | null {
  const originId = tuple[1]
  const originSlot = tuple[2]
  const targetId = tuple[3]
  const targetSlot = tuple[4]
  const type = tuple[5]
  if (
    !isIdValue(originId) ||
    typeof originSlot !== 'number' ||
    !Number.isInteger(originSlot) ||
    !isIdValue(targetId) ||
    typeof targetSlot !== 'number' ||
    !Number.isInteger(targetSlot) ||
    typeof type !== 'string'
  )
    return null
  return {
    originId: String(originId),
    originSlot,
    targetId: String(targetId),
    targetSlot,
    type
  }
}
