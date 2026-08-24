import { shallowReactive, toRaw } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type {
  INodeInputSlot,
  INodeOutputSlot,
  INodeSlot
} from '@/lib/litegraph/src/interfaces'
import { NodeInputSlot } from '@/lib/litegraph/src/node/NodeInputSlot'
import { NodeOutputSlot } from '@/lib/litegraph/src/node/NodeOutputSlot'

type SlotDescriptor<T extends INodeSlot> = T

export type InputSlotDescriptor = INodeInputSlot
export type OutputSlotDescriptor = INodeOutputSlot

const slotProjection = Symbol('slotProjection')
const slotDescriptor = Symbol('slotDescriptor')
const sourceSlot = Symbol('sourceSlot')
const callbackArrayMethods = new Set([
  'every',
  'filter',
  'find',
  'findIndex',
  'findLast',
  'findLastIndex',
  'flatMap',
  'forEach',
  'map',
  'reduce',
  'reduceRight',
  'some'
])
const projectedArrayMethods = new Set([
  'at',
  'entries',
  'flat',
  'includes',
  'keys',
  'slice',
  'toReversed',
  'toSorted',
  'toSpliced',
  'values'
])

function descriptorOf<T extends INodeSlot>(slot: T): SlotDescriptor<T> {
  const raw = toRaw(slot)
  const descriptor: T = {
    ...raw,
    boundingRect: raw.boundingRect ? [...raw.boundingRect] : [0, 0, 0, 0]
  }
  Reflect.deleteProperty(descriptor, '_node')
  Object.defineProperty(descriptor, sourceSlot, { value: slot })
  return shallowReactive(descriptor)
}

function project<T extends INodeSlot>(
  descriptor: SlotDescriptor<T>,
  create: (slot: T) => T
): T {
  const projection = create(toRaw(descriptor))
  const view = new Proxy(projection, {
    get(target, property, receiver) {
      if (
        typeof property !== 'symbol' &&
        property !== 'boundingRect' &&
        !property.startsWith('_') &&
        property !== 'link' &&
        property !== 'links' &&
        Object.hasOwn(descriptor, property)
      )
        return Reflect.get(descriptor, property)
      return Reflect.get(target, property, receiver)
    },
    set(target, property, value, receiver) {
      if (
        typeof property !== 'symbol' &&
        property !== 'boundingRect' &&
        !property.startsWith('_') &&
        property !== 'link' &&
        property !== 'links'
      )
        Reflect.set(descriptor, property, value)
      return Reflect.set(target, property, value, receiver)
    },
    deleteProperty(target, property) {
      Reflect.deleteProperty(descriptor, property)
      return Reflect.deleteProperty(target, property)
    }
  })
  Object.defineProperty(toRaw(projection), slotDescriptor, {
    value: toRaw(descriptor)
  })
  return view
}

function slotView<T extends INodeSlot>(
  descriptors: SlotDescriptor<T>[],
  create: (slot: T) => T
): T[] {
  return new Proxy(descriptors, {
    get(target, property, receiver) {
      if (property === Symbol.iterator)
        return function* () {
          for (let index = 0; index < target.length; index++)
            yield Reflect.get(receiver, String(index))
        }
      if (typeof property === 'string' && callbackArrayMethods.has(property))
        return Reflect.get(Array.prototype, property).bind(receiver)
      if (typeof property === 'string' && projectedArrayMethods.has(property)) {
        const projected = Array.from({ length: target.length }, (_, index) =>
          Reflect.get(receiver, String(index))
        )
        return Reflect.get(projected, property).bind(projected)
      }
      if (property === 'indexOf')
        return (slot: T, fromIndex = 0) => {
          const descriptor = Reflect.get(slot, slotDescriptor)
          for (let index = fromIndex; index < target.length; index++) {
            if (
              Reflect.get(receiver, String(index)) === slot ||
              toRaw(target[index]) === descriptor ||
              Reflect.get(toRaw(target[index]), sourceSlot) === slot
            )
              return index
          }
          return -1
        }
      const value = Reflect.get(target, property, receiver)
      if (typeof property === 'symbol' || !/^\d+$/.test(property)) return value
      if (!value) return value
      const raw = toRaw(value) as T & { [slotProjection]?: T }
      const existing = raw[slotProjection]
      if (existing) return existing
      const created = project(value, create)
      Object.defineProperty(raw, slotProjection, { value: created })
      return created
    },
    set(target, property, value, receiver) {
      if (typeof property !== 'symbol' && /^\d+$/.test(property)) {
        const descriptor =
          Reflect.get(value, slotDescriptor) ?? descriptorOf(value as T)
        return Reflect.set(target, property, descriptor, receiver)
      }
      return Reflect.set(target, property, value, receiver)
    }
  })
}

export function inputSlotView(
  descriptors: InputSlotDescriptor[],
  node: LGraphNode
): INodeInputSlot[] {
  return slotView(descriptors, (slot) => new NodeInputSlot(slot, node))
}

export function outputSlotView(
  descriptors: OutputSlotDescriptor[],
  node: LGraphNode
): INodeOutputSlot[] {
  return slotView(descriptors, (slot) => new NodeOutputSlot(slot, node))
}
