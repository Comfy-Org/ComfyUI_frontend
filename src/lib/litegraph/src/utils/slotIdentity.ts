import type { UUID } from '@/lib/litegraph/src/utils/uuid'
import { warnDeprecated } from '@/lib/litegraph/src/utils/feedback'

const DUPLICATE_IDENTITY_SEPARATOR = '__'

export function resolveCanonicalSlotName<
  TSlot extends { id: UUID; name: string }
>(slots: readonly TSlot[], requestedName: string, slotId: UUID): string {
  if (!slots.some((slot) => slot.id !== slotId && slot.name === requestedName))
    return requestedName

  return `${requestedName}${DUPLICATE_IDENTITY_SEPARATOR}${slotId}`
}

export function normalizeLegacySlotIdentity<
  TSlot extends { id: UUID; name: string; label?: string }
>(slots: TSlot[]): void {
  const seenCounts = new Map<string, number>()

  for (const slot of slots) {
    const count = seenCounts.get(slot.name) ?? 0
    seenCounts.set(slot.name, count + 1)
    if (count === 0) continue

    warnDeprecated(
      '[DEPRECATED] Legacy subgraph workflows with duplicate slot names are automatically canonicalized by appending a stable slot ID. Remedy: resave the workflow in the current frontend to persist canonical slot names and avoid compatibility fallback.'
    )

    const oldName = slot.name
    slot.label ??= slot.name
    slot.name = `${slot.name}${DUPLICATE_IDENTITY_SEPARATOR}${slot.id}`
    console.warn(
      'Subgraph slot identity deduplicated during legacy normalization',
      {
        slotId: slot.id,
        oldName,
        canonicalName: slot.name
      }
    )
  }
}
