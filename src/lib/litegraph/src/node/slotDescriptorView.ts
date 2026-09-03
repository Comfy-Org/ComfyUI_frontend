import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import { NodeInputSlot } from '@/lib/litegraph/src/node/NodeInputSlot'
import { toClass } from '@/lib/litegraph/src/utils/type'

const assignedInputViews = new WeakMap<
  INodeInputSlot[],
  WeakMap<INodeInputSlot, INodeInputSlot>
>()

export function createInputSlotView(
  node: LGraphNode,
  inputs: INodeInputSlot[]
): INodeInputSlot[] {
  const assignedViews = new WeakMap<INodeInputSlot, INodeInputSlot>()
  const view = createSlotView(node, inputs, (value) => {
    const input = isInputSlot(value)
      ? toClass(NodeInputSlot, value, node)
      : value
    if (isInputSlot(value) && isInputSlot(input) && value !== input)
      assignedViews.set(value, input)
    return input
  })
  assignedInputViews.set(view, assignedViews)
  return view
}

export function createOutputSlotView(
  node: LGraphNode,
  outputs: INodeOutputSlot[]
): INodeOutputSlot[] {
  return createSlotView(node, outputs)
}

function createSlotView<T>(
  node: LGraphNode,
  slots: T[],
  normalize: (value: unknown) => unknown = (value) => value
): T[] {
  return new Proxy(slots, {
    set(target, property, value: unknown, receiver) {
      const nextValue = isArrayIndex(property) ? normalize(value) : value
      const changed = Reflect.get(target, property) !== nextValue
      const updated = Reflect.set(target, property, nextValue, receiver)
      if (updated && changed) node._slotsDirty = true
      return updated
    },
    deleteProperty(target, property) {
      const changed = Reflect.has(target, property)
      const updated = Reflect.deleteProperty(target, property)
      if (updated && changed) node._slotsDirty = true
      return updated
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

function isInputSlot(value: unknown): value is INodeInputSlot {
  return (
    value !== null &&
    typeof value === 'object' &&
    'name' in value &&
    'type' in value
  )
}
