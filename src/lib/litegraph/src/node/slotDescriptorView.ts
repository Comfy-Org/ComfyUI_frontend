import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type {
  INodeInputSlot,
  INodeOutputSlot,
  OptionalProps
} from '@/lib/litegraph/src/interfaces'
import { NodeInputSlot } from '@/lib/litegraph/src/node/NodeInputSlot'
import { NodeOutputSlot } from '@/lib/litegraph/src/node/NodeOutputSlot'
import { toClass } from '@/lib/litegraph/src/utils/type'

type SlotDescriptor = INodeInputSlot | INodeOutputSlot

interface SlotClass<T extends SlotDescriptor> {
  new (slot: OptionalProps<T, 'boundingRect'>, node: LGraphNode): T
}

const assignedInputViews = new WeakMap<
  INodeInputSlot[],
  WeakMap<INodeInputSlot, INodeInputSlot>
>()

const assignedOutputViews = new WeakMap<
  INodeOutputSlot[],
  WeakMap<INodeOutputSlot, INodeOutputSlot>
>()

/**
 * Wraps a slot array so that plain slot descriptors written by index are
 * upgraded to reactive slot class instances. Extensions historically replaced
 * slots with plain objects; without the upgrade those slots are not reactive
 * and the Vue slot renderers do not update on label-only renames.
 */
function createSlotView<T extends SlotDescriptor>(
  cls: SlotClass<T>,
  node: LGraphNode,
  slots: T[],
  registry: WeakMap<T[], WeakMap<T, T>>
): T[] {
  const assignedViews = new WeakMap<T, T>()
  const view = new Proxy(slots, {
    set(target, property, value: unknown, receiver) {
      const slot =
        isArrayIndex(property) && isSlotDescriptor(value)
          ? toClass(cls, value as T, node)
          : value
      if (isSlotDescriptor(value) && isSlotDescriptor(slot) && value !== slot)
        assignedViews.set(value as T, slot as T)
      return Reflect.set(target, property, slot, receiver)
    }
  })
  registry.set(view, assignedViews)
  return view
}

export function createInputSlotView(
  node: LGraphNode,
  inputs: INodeInputSlot[]
): INodeInputSlot[] {
  return createSlotView(NodeInputSlot, node, inputs, assignedInputViews)
}

export function createOutputSlotView(
  node: LGraphNode,
  outputs: INodeOutputSlot[]
): INodeOutputSlot[] {
  return createSlotView(NodeOutputSlot, node, outputs, assignedOutputViews)
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

function isSlotDescriptor(value: unknown): value is SlotDescriptor {
  return (
    value !== null &&
    typeof value === 'object' &&
    'name' in value &&
    'type' in value
  )
}
