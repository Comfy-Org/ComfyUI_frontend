import { isPlainObject } from 'es-toolkit'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type { SlotRef } from '@/platform/nodeApi/v4/types'
import { knownSlotId } from './slotIds'

/** Refuses anything but a slot id or name, or `{ index }` with a whole index of zero or more. */
export function assertSlotRef(
  member: string,
  ref: unknown
): asserts ref is SlotRef {
  if (typeof ref !== 'string' && !isPosition(ref)) {
    throw invalidArgument(member, 'a slot id, a slot name or { index }', ref)
  }
}

/**
 * The index of the slot `ref` names among `slots`: by slot id, else by name,
 * else by position; `-1` if none does. A name two slots share throws.
 */
export function slotIndexOf(
  member: string,
  slots: readonly { readonly name: string }[],
  ref: SlotRef
): number {
  if (typeof ref !== 'string') return ref.index < slots.length ? ref.index : -1
  const byId = slots.findIndex((slot) => knownSlotId(slot) === ref)
  if (byId !== -1) return byId
  const named = slots.flatMap((slot, index) =>
    slot.name === ref ? [index] : []
  )
  if (named.length > 1) {
    throw invalidArgument(member, 'a slot name only one slot has', ref)
  }
  return named.length === 1 ? named[0] : -1
}

function isPosition(ref: unknown): boolean {
  if (!isPlainObject(ref)) return false
  const { index }: Readonly<Record<string, unknown>> = ref
  return typeof index === 'number' && Number.isSafeInteger(index) && index >= 0
}
