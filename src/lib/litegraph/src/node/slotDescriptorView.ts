import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import { NodeInputSlot } from '@/lib/litegraph/src/node/NodeInputSlot'
import { toClass } from '@/lib/litegraph/src/utils/type'

export function createInputSlotView(
  node: LGraphNode,
  inputs: INodeInputSlot[]
): INodeInputSlot[] {
  return new Proxy(inputs, {
    set(target, property, value: unknown, receiver) {
      const input =
        isArrayIndex(property) && isInputSlot(value)
          ? toClass(NodeInputSlot, value, node)
          : value
      return Reflect.set(target, property, input, receiver)
    }
  })
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
