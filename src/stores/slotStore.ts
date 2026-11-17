import { defineStore } from 'pinia'
import { shallowReactive, toRaw } from 'vue'

import type { SlotMembership } from '@comfyorg/graph-model/slotMembership'
import type { SlotRecordId } from '@comfyorg/graph-model/slotRecordId'
import type { SlotRecord } from '@comfyorg/graph-model/slots'

export function createSlotMembership(
  inputs: readonly SlotRecord[] = [],
  outputs: readonly SlotRecord[] = []
): SlotMembership {
  return shallowReactive({
    inputIds: shallowReactive(inputs.map((record) => record.id)),
    outputIds: shallowReactive(outputs.map((record) => record.id)),
    records: shallowReactive(
      Object.fromEntries(
        [...inputs, ...outputs].map((record) => [
          record.id,
          shallowReactive(record)
        ])
      )
    )
  })
}

function membershipIds(slots: SlotMembership): Set<SlotRecordId> {
  return new Set([...slots.inputIds, ...slots.outputIds].filter(Boolean))
}

export const useSlotStore = defineStore('slots', () => {
  const registered = new Map<SlotMembership, Set<SlotRecordId>>()
  const byId = shallowReactive(
    new Map<SlotRecordId, { record: SlotRecord; owners: Set<SlotMembership> }>()
  )

  function getSlotRecord(id: SlotRecordId): SlotRecord | undefined {
    return byId.get(id)?.record
  }

  function canRegister(slots: SlotMembership): boolean {
    for (const id of membershipIds(slots)) {
      const incumbent = byId.get(id)?.record
      if (incumbent && toRaw(incumbent) !== toRaw(slots.records[id]))
        return false
    }
    return true
  }

  function release(id: SlotRecordId, slots: SlotMembership): void {
    const entry = byId.get(id)
    entry?.owners.delete(slots)
    if (entry?.owners.size === 0) byId.delete(id)
  }

  function synchronize(slots: SlotMembership): void {
    const owner = toRaw(slots)
    const previous = registered.get(owner)
    if (!previous) return
    const next = membershipIds(slots)
    for (const id of previous) {
      if (!next.has(id)) release(id, owner)
    }
    for (const id of next) {
      if (previous.has(id)) continue
      const incumbent = byId.get(id)
      if (incumbent) incumbent.owners.add(owner)
      else byId.set(id, { record: slots.records[id], owners: new Set([owner]) })
    }
    registered.set(owner, next)
  }

  function register(slots: SlotMembership): boolean {
    if (!canRegister(slots)) return false
    const owner = toRaw(slots)
    if (!registered.has(owner)) registered.set(owner, new Set())
    synchronize(slots)
    return true
  }

  function unregister(slots: SlotMembership): void {
    const owner = toRaw(slots)
    const ids = registered.get(owner)
    if (!ids) return
    for (const id of ids) release(id, owner)
    registered.delete(owner)
  }

  function editMembership(
    slots: SlotMembership,
    edit: () => boolean,
    record?: SlotRecord
  ): boolean {
    if (record) {
      const incumbent = Object.hasOwn(slots.records, record.id)
        ? slots.records[record.id]
        : byId.get(record.id)?.record
      if (incumbent && toRaw(incumbent) !== toRaw(record)) return false
      slots.records[record.id] = record
    }
    try {
      return edit()
    } finally {
      const ids = membershipIds(slots)
      for (const candidate of Object.values(slots.records)) {
        if (!ids.has(candidate.id)) delete slots.records[candidate.id]
      }
      synchronize(slots)
    }
  }

  return { canRegister, editMembership, getSlotRecord, register, unregister }
})
