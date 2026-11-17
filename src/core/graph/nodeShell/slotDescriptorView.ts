import type { LGraphNode } from '@comfyorg/graph-model/entityRegistry'
import type { ISlotType, OptionalProps } from '@comfyorg/graph-model/interfaces'
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

type SlotInit = OptionalProps<SlotDescriptor, 'boundingRect'>

const assignedInputViews = new WeakMap<
  INodeInputSlot[],
  WeakMap<object, INodeInputSlot>
>()

export function createInputSlotView(
  node: LGraphNode,
  slots: SlotMembership
): INodeInputSlot[] {
  const assignedViews = new WeakMap<object, INodeInputSlot>()
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
    slot: SlotInit,
    node: LGraphNode,
    descriptor?: SlotRecord
  ) => NodeSlot,
  assignedViews?: WeakMap<object, INodeInputSlot>
): SlotDescriptor[] {
  function adapter(value: SlotRecord | undefined): unknown {
    if (!isSlot(value)) return value
    return slotAdapters.get(toRaw(value)) ?? new Slot(value, node, value)
  }

  function record(value: unknown): SlotRecord | undefined {
    if (value === null || typeof value !== 'object') return undefined
    const slot = value instanceof Slot ? value : createSlot(value)
    if (!slot) return undefined
    assignedViews?.set(value, slot)
    return slot._state
  }

  function createSlot(value: object): NodeSlot | undefined {
    const init = parseSlotInit(value)
    return init && new Slot(init, node)
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

  function isRefusedIndexDescriptor(
    property: string | symbol,
    attributes: PropertyDescriptor
  ): boolean {
    return (
      isArrayIndex(property) &&
      (attributes.configurable === false ||
        (!Object.hasOwn(ids, property) && !attributes.configurable) ||
        'get' in attributes ||
        'set' in attributes)
    )
  }

  function defineMember(
    target: SlotDescriptor[],
    property: string | symbol,
    attributes: PropertyDescriptor,
    entry?: SlotRecord
  ): boolean {
    return useSlotStore().editMembership(
      slots,
      () =>
        Reflect.defineProperty(ids, property, attributes) &&
        mirrorProperty(target, property),
      entry
    )
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
      if (isRefusedIndexDescriptor(property, attributes)) return false
      if (!isArrayIndex(property) || !('value' in attributes))
        return defineMember(target, property, attributes)
      const entry = record(attributes.value)
      return (
        !!entry &&
        defineMember(
          target,
          property,
          { ...attributes, value: entry.id },
          entry
        )
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

function parseSlotInit(value: object): SlotInit | undefined {
  const name = 'name' in value ? value.name : undefined
  const type = 'type' in value ? value.type : undefined
  if (name !== undefined && typeof name !== 'string') return undefined
  if (!isSlotType(type)) return undefined
  return { ...value, name: name ?? '', type }
}

function isSlotType(type: unknown): type is ISlotType {
  return (
    typeof type === 'number' ||
    typeof type === 'string' ||
    (Array.isArray(type) && type.every((item) => typeof item === 'string'))
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
