import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { checkedFields } from '@/platform/nodeApi/v4/checkedFields'
import { knownSlotId } from './slotIds'

/** A pack's slot reference, read once: a slot id or name, or a position. */
export type CheckedSlotRef =
  | { readonly key: string }
  | { readonly index: number }

/** Refuses anything but a string, or a plain `{ index }` whose index is a whole number of zero or more. */
export function checkedSlotRef(member: string, ref: unknown): CheckedSlotRef {
  if (typeof ref === 'string') return { key: ref }
  if (typeof ref !== 'object' || ref === null) {
    throw invalidArgument(member, 'a slot id, a slot name or { index }', ref)
  }
  const { index } = checkedFields(member, '{ index }', ref, INDEX_FIELDS)
  if (typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0) {
    throw invalidArgument(member, 'index as a whole number of 0 or more', index)
  }
  return { index }
}

const INDEX_FIELDS = { index: true } as const

/**
 * The index of the slot `ref` names among `slots`: by slot id, else by name,
 * else by position; `-1` if none does. A name two slots share throws.
 */
export function slotIndexOf(
  member: string,
  slots: readonly { readonly name: string }[],
  ref: CheckedSlotRef
): number {
  if ('index' in ref) return ref.index < slots.length ? ref.index : -1
  const { key } = ref
  const byId = slots.findIndex((slot) => knownSlotId(slot) === key)
  if (byId !== -1) return byId
  const named = slots.flatMap((slot, index) =>
    slot.name === key ? [index] : []
  )
  if (named.length > 1) {
    throw invalidArgument(member, 'a slot name only one slot has', key)
  }
  return named.length === 1 ? named[0] : -1
}
