import type { SlotRecordId } from './slotRecordId'
import type { SlotRecord } from './slots'

export interface SlotMembership {
  inputIds: SlotRecordId[]
  outputIds: SlotRecordId[]
  records: Record<SlotRecordId, SlotRecord>
}

export function getInputSlotRecords(slots: SlotMembership): SlotRecord[] {
  return slots.inputIds.map((id) => slots.records[id])
}

export function getOutputSlotRecords(slots: SlotMembership): SlotRecord[] {
  return slots.outputIds.map((id) => slots.records[id])
}
