export type SlotRecordId = string & { readonly __brand: 'SlotRecordId' }

export function toSlotRecordId(value: string): SlotRecordId {
  return value as SlotRecordId
}
