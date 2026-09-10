/**
 * Slot identity and reference resolution.
 *
 * An index is a *position*, not an identity: it shifts whenever another slot is
 * inserted or removed, which is exactly what dynamic-slot packs do. So slots get
 * a stable `SlotId`, and positional access must be written explicitly.
 */
import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import { extensionValue } from '@/lib/litegraph/src/utils/extensionValue'

import { ComfyAmbiguousSlotError } from './errors'

export type SlotId = string & { readonly __brand: 'SlotId' }

/**
 * A slot reference: a string (id or name), or an explicit `{ index }`.
 *
 * A bare `number` is deliberately not accepted so positional access is visible
 * at the call site and greppable:
 *
 *     output.connectTo(node, 'image')       // by name — preferred
 *     output.connectTo(node, { index: 0 })  // by position — explicit
 */
export type SlotRef = SlotId | string | { readonly index: number }

type AnySlot = INodeInputSlot | INodeOutputSlot

/**
 * Stable ids without mutating the slot objects. A WeakMap keeps the id alive
 * exactly as long as the slot itself, so nothing is retained after removal.
 */
const slotIds = new WeakMap<object, SlotId>()
let nextSlotId = 0

export function slotIdOf(slot: AnySlot): SlotId {
  let id = slotIds.get(slot)
  if (id === undefined) {
    id = `slot:${++nextSlotId}` as SlotId
    slotIds.set(slot, id)
  }
  return id
}

/** True for '0', '12' — but not '', '1.5', '-1', '01', ' 1'. */
function isCanonicalIndex(value: string): boolean {
  return /^(?:0|[1-9]\d*)$/.test(value)
}

export interface ResolveOptions {
  /**
   * Whether the backend supplies slot names yet. While false, a canonical
   * integer string resolves positionally, so `'0'` addresses slot 0 and call
   * sites need no rewrite once names arrive.
   *
   * Retire this together with the release that ships names — until then a pack
   * passing `'2'` meaning a name would silently bind slot 2.
   */
  readonly namedSlotsAvailable: boolean
}

/**
 * Resolves a reference to an index, or `-1` when it matches nothing.
 *
 * Order: SlotId, then exact name, then the transitional integer-string rule.
 * Throws on an ambiguous name rather than guessing — output names come from
 * `RETURN_NAMES` and may legitimately repeat.
 */
export function resolveSlotRef(
  slots: readonly AnySlot[],
  ref: SlotRef,
  options: ResolveOptions = { namedSlotsAvailable: false }
): number {
  const runtimeRef = extensionValue(ref)
  if (typeof runtimeRef === 'object' && runtimeRef !== null) {
    const { index } = runtimeRef
    return Number.isInteger(index) && index >= 0 && index < slots.length
      ? index
      : -1
  }
  if (typeof runtimeRef !== 'string') return -1

  const byId = slots.findIndex((slot) => slotIds.get(slot) === runtimeRef)
  if (byId !== -1) return byId

  const named = slots.reduce<number[]>(
    (acc, slot, index) => (slot.name === runtimeRef ? [...acc, index] : acc),
    []
  )
  if (named.length > 1)
    throw new ComfyAmbiguousSlotError(runtimeRef, named.length)
  if (named.length === 1) return named[0]

  if (!options.namedSlotsAvailable && isCanonicalIndex(runtimeRef)) {
    const index = Number(runtimeRef)
    return index < slots.length ? index : -1
  }

  return -1
}

/** Describes a reference for error messages, without leaking internals. */
export function describeSlotRef(ref: SlotRef): string {
  const runtimeRef = extensionValue(ref)
  return typeof runtimeRef === 'object' && runtimeRef !== null
    ? `index ${runtimeRef.index}`
    : `'${String(runtimeRef)}'`
}
