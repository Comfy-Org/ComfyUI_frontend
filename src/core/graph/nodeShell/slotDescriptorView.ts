import type { LGraphNode } from '@comfyorg/graph-model/entityRegistry'
import type { SlotMembership } from '@comfyorg/graph-model/slotMembership'
import { toRaw } from 'vue'

import type {
  INodeInputSlot,
  INodeOutputSlot,
  SlotDescriptor,
  SlotRecord
} from '@comfyorg/graph-model/slots'
import { NodeInputSlot } from '@/lib/litegraph/src/node/NodeInputSlot'
import { NodeOutputSlot } from '@/lib/litegraph/src/node/NodeOutputSlot'
import { useSlotStore } from '@/stores/slotStore'

import type { NodeSlot } from '@/lib/litegraph/src/node/NodeSlot'
import { slotAdapters } from '@/lib/litegraph/src/node/slotDescriptorState'

const assignedInputViews = new WeakMap<
  INodeInputSlot[],
  WeakMap<INodeInputSlot, INodeInputSlot>
>()

export function createInputSlotView(
  node: LGraphNode,
  slots: SlotMembership
): INodeInputSlot[] {
  const assignedViews = new WeakMap<INodeInputSlot, INodeInputSlot>()
  const view = createSlotView(
    node,
    slots,
    slots.inputIds,
    NodeInputSlot,
    assignedViews
  )
  assignedInputViews.set(view, assignedViews)
  return view
}

export function createOutputSlotView(
  node: LGraphNode,
  slots: SlotMembership
): INodeOutputSlot[] {
  return createSlotView(node, slots, slots.outputIds, NodeOutputSlot)
}

function createSlotView(
  node: LGraphNode,
  slots: SlotMembership,
  ids: SlotMembership['inputIds'],
  Slot: new (
    slot: SlotDescriptor,
    node: LGraphNode,
    descriptor?: SlotRecord
  ) => NodeSlot,
  assignedViews?: WeakMap<INodeInputSlot, INodeInputSlot>
): SlotDescriptor[] {
  function adapter(value: SlotRecord | undefined): unknown {
    if (!isSlot(value)) return value
    return slotAdapters.get(toRaw(value)) ?? new Slot(value, node, value)
  }

  function record(value: unknown): SlotRecord | undefined {
    if (!isSlot(value)) return undefined
    const slot = value instanceof Slot ? value : new Slot(value, node)
    assignedViews?.set(value, slot)
    return slot._state
  }

  function mirrorProperty(
    target: SlotDescriptor[],
    property: string | symbol
  ): boolean {
    if (isArrayIndex(property)) return true
    const descriptor = Reflect.getOwnPropertyDescriptor(ids, property)
    return descriptor
      ? Reflect.defineProperty(target, property, descriptor)
      : Reflect.deleteProperty(target, property)
  }

  return new Proxy<SlotDescriptor[]>([], {
    get(_target, property, receiver) {
      if (!Object.hasOwn(ids, property) && property in Array.prototype)
        return Reflect.get(Array.prototype, property, receiver)
      return isArrayIndex(property)
        ? adapter(slots.records[ids[Number(property)]])
        : Reflect.get(ids, property, receiver)
    },
    set(target, property, value: unknown, receiver) {
      const entry = isArrayIndex(property) ? record(value) : undefined
      if (isArrayIndex(property) && !entry) return false
      return useSlotStore().editMembership(
        slots,
        () =>
          Reflect.set(
            ids,
            property,
            entry ? entry.id : value,
            entry ? ids : receiver
          ) && mirrorProperty(target, property),
        entry
      )
    },
    deleteProperty(target, property) {
      return useSlotStore().editMembership(
        slots,
        () =>
          Reflect.deleteProperty(ids, property) &&
          mirrorProperty(target, property)
      )
    },
    defineProperty(target, property, attributes) {
      if (
        isArrayIndex(property) &&
        (attributes.configurable === false ||
          (!Object.hasOwn(ids, property) && !attributes.configurable) ||
          'get' in attributes ||
          'set' in attributes)
      )
        return false
      const entry =
        isArrayIndex(property) && 'value' in attributes
          ? record(attributes.value)
          : undefined
      if (isArrayIndex(property) && 'value' in attributes && !entry)
        return false
      return useSlotStore().editMembership(
        slots,
        () => {
          const defined = Reflect.defineProperty(
            ids,
            property,
            entry ? { ...attributes, value: entry.id } : attributes
          )
          return defined && mirrorProperty(target, property)
        },
        entry
      )
    },
    has: (_target, property) => Reflect.has(ids, property),
    ownKeys: () => Reflect.ownKeys(ids),
    preventExtensions() {
      return false
    },
    getOwnPropertyDescriptor(_target, property) {
      const descriptor = Reflect.getOwnPropertyDescriptor(ids, property)
      if (descriptor && isArrayIndex(property) && 'value' in descriptor)
        return {
          ...descriptor,
          value: adapter(slots.records[ids[Number(property)]])
        }
      return descriptor
    }
  })
}

export function resolveInputSlotView(
  inputs: INodeInputSlot[],
  input: INodeInputSlot
): INodeInputSlot {
  return assignedInputViews.get(inputs)?.get(input) ?? input
}

function isArrayIndex(property: string | symbol): property is string {
  if (typeof property !== 'string') return false
  const index = Number(property)
  return (
    Number.isInteger(index) &&
    index >= 0 &&
    index < 2 ** 32 - 1 &&
    String(index) === property
  )
}

function isSlot(value: unknown): value is SlotDescriptor {
  return (
    value !== null &&
    typeof value === 'object' &&
    'name' in value &&
    'type' in value
  )
}
