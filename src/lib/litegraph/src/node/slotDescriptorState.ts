import { shallowReactive, toRaw } from 'vue'

import type { SlotDescriptor, SlotRecord } from '@comfyorg/graph-model/slots'
import { toSlotRecordId } from '@comfyorg/graph-model/slotRecordId'
import { createUuidv4 } from '@/utils/uuid'

export const slotAdapters = new WeakMap<SlotDescriptor, SlotDescriptor>()

const metadataKeys = [
  'name',
  'type',
  'localized_name',
  'label',
  'dir',
  'removable',
  'shape',
  'color_off',
  'color_on',
  'locked',
  'nameLocked',
  'widget',
  'widgetId',
  'alwaysVisible',
  'hasErrors',
  'pos',
  'slot_index'
] as const satisfies readonly (keyof SlotDescriptor)[]

const descriptorKeys: ReadonlySet<PropertyKey> = new Set(metadataKeys)

export function createSlotAdapter<T extends object>(slot: T): T {
  const view = shallowReactive(slot)
  return new Proxy(slot, {
    get: (target, key, receiver) =>
      Reflect.get(descriptorKeys.has(key) ? target : view, key, receiver),
    set: (target, key, value, receiver) =>
      Reflect.set(
        descriptorKeys.has(key) ? target : view,
        key,
        value,
        receiver
      ),
    has: (_target, key) => Reflect.has(view, key),
    ownKeys: () => Reflect.ownKeys(view),
    deleteProperty: (target, key) =>
      descriptorKeys.has(key)
        ? Reflect.set(target, key, undefined)
        : Reflect.deleteProperty(view, key)
  })
}

export function bindSlotDescriptor(
  slot: SlotDescriptor & { readonly boundingRect: Float64Array },
  existing?: SlotRecord
): SlotRecord {
  const descriptor = shallowReactive(
    existing ?? {
      id: toSlotRecordId(createUuidv4()),
      name: slot.name,
      type: slot.type,
      boundingRect: slot.boundingRect.subarray()
    }
  )
  Object.defineProperty(descriptor, 'id', {
    value: descriptor.id,
    writable: false,
    enumerable: false,
    configurable: false
  })
  if (existing) descriptor.boundingRect = slot.boundingRect.subarray()
  for (const key of metadataKeys) {
    if (!existing) Reflect.set(descriptor, key, Reflect.get(slot, key))
    Object.defineProperty(slot, key, {
      configurable: true,
      enumerable: true,
      get: () => descriptor[key],
      set: (value: unknown) => Reflect.set(descriptor, key, value)
    })
  }
  slotAdapters.set(toRaw(descriptor), slot)
  return descriptor
}
