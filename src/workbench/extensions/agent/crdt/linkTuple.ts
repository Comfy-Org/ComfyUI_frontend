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
