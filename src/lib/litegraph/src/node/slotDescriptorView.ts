import type { LGraphNode } from '@comfyorg/graph-model/entityRegistry'
import { toRaw } from 'vue'

import type {
  INodeInputSlot,
  INodeOutputSlot,
  InputSlotRecord,
  OutputSlotRecord,
  SlotDescriptor,
  SlotRecord
} from '@comfyorg/graph-model/slots'
import { NodeInputSlot } from '@/lib/litegraph/src/node/NodeInputSlot'
import { NodeOutputSlot } from '@/lib/litegraph/src/node/NodeOutputSlot'

import type { NodeSlot } from './NodeSlot'
import { slotAdapters } from './slotDescriptorState'

const assignedInputViews = new WeakMap<
  INodeInputSlot[],
  WeakMap<INodeInputSlot, INodeInputSlot>
>()

export function createInputSlotView(
  node: LGraphNode,
  inputs: InputSlotRecord[]
): INodeInputSlot[] {
  const assignedViews = new WeakMap<INodeInputSlot, INodeInputSlot>()
  const view = createSlotView(node, inputs, NodeInputSlot, assignedViews)
  assignedInputViews.set(view, assignedViews)
  return view
}

export function createOutputSlotView(
  node: LGraphNode,
  outputs: OutputSlotRecord[]
): INodeOutputSlot[] {
  return createSlotView(node, outputs, NodeOutputSlot)
}

function createSlotView(
  node: LGraphNode,
  descriptors: SlotRecord[],
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

  function descriptor(property: string | symbol, value: unknown): unknown {
    if (!isArrayIndex(property) || !isSlot(value)) return value
    const slot = value instanceof Slot ? value : new Slot(value, node)
    assignedViews?.set(value, slot)
    return slot._state
  }

  return new Proxy(descriptors, {
    get(target, property, receiver) {
      if (!Object.hasOwn(target, property) && property in Array.prototype)
        return Reflect.get(Array.prototype, property, receiver)
      return isArrayIndex(property)
        ? adapter(target[Number(property)])
        : Reflect.get(target, property, receiver)
    },
    set(target, property, value: unknown) {
      return Reflect.set(target, property, descriptor(property, value))
    },
    defineProperty(target, property, attributes) {
      if (
        isArrayIndex(property) &&
        (attributes.configurable === false ||
          (!Object.hasOwn(target, property) && !attributes.configurable))
      )
        return false
      return Reflect.defineProperty(
        target,
        property,
        'value' in attributes
          ? { ...attributes, value: descriptor(property, attributes.value) }
          : attributes
      )
    },
    preventExtensions() {
      return false
    },
    getOwnPropertyDescriptor(target, property) {
      const descriptor = Reflect.getOwnPropertyDescriptor(target, property)
      if (descriptor && isArrayIndex(property) && 'value' in descriptor)
        return { ...descriptor, value: adapter(target[Number(property)]) }
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
