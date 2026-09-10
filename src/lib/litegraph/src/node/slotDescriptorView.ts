import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import { NodeInputSlot } from '@/lib/litegraph/src/node/NodeInputSlot'
import { NodeOutputSlot } from '@/lib/litegraph/src/node/NodeOutputSlot'
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
  const view = new Proxy(inputs, {
    set(target, property, value: unknown, receiver) {
      const input =
        isArrayIndex(property) && isInputSlot(value)
          ? toClass(NodeInputSlot, value, node)
          : value
      if (isInputSlot(value) && isInputSlot(input) && value !== input)
        assignedViews.set(value, input)
      return Reflect.set(target, property, input, receiver)
    }
  })
  assignedInputViews.set(view, assignedViews)
  return view
}

export function createOutputSlotView(
  node: LGraphNode,
  outputs: INodeOutputSlot[]
): INodeOutputSlot[] {
  return new Proxy(outputs, {
    set(target, property, value: unknown, receiver) {
      const output =
        isArrayIndex(property) && isOutputSlot(value)
          ? toClass(NodeOutputSlot, value, node)
          : value
      return Reflect.set(target, property, output, receiver)
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

function isOutputSlot(value: unknown): value is INodeOutputSlot {
  return (
    value !== null &&
    typeof value === 'object' &&
    'name' in value &&
    'type' in value
  )
}
