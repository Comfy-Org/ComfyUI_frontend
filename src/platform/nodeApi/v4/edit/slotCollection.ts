import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type { LiveNode, NodeHandles } from '@/platform/nodeApi/v4/nodeHandle'
import type {
  SlotCollection,
  SlotOptions,
  SlotRef,
  SlotType
} from '@/platform/nodeApi/v4/types'
import { knownSlotId } from './slotIds'
import { checkedSlotRef, slotIndexOf } from './slotRef'

/** How a collection reaches one side of a node's slots. */
export interface SlotSideAccess<
  TSlot extends { readonly name: string },
  THandle
> {
  slotsOf(node: LGraphNode): readonly TSlot[]
  handleFor(graph: LGraph, node: LGraphNode, slot: TSlot): THandle
  add(name: string, type: SlotType, options?: SlotOptions): THandle | undefined
  remove(slot: THandle): boolean
  reorder(names: readonly string[]): boolean
}

/** A node's inputs or outputs: reads of the live list, and edits through `comfy.edit`. */
export function slotCollection<
  TSlot extends { readonly name: string },
  THandle
>(
  node: object,
  nodes: NodeHandles,
  side: SlotSideAccess<TSlot, THandle>
): SlotCollection<THandle> {
  const live = (): LiveNode | undefined => nodes.locator(node)?.()

  function handleWhere(
    find: (slots: readonly TSlot[]) => number
  ): THandle | undefined {
    const found = live()
    if (!found) return undefined
    const slots = side.slotsOf(found.node)
    const index = find(slots)
    return index === -1
      ? undefined
      : side.handleFor(found.graph, found.node, slots[index])
  }

  function all(): readonly THandle[] | undefined {
    const found = live()
    if (!found) return undefined
    return Object.freeze(
      side
        .slotsOf(found.node)
        .map((slot) => side.handleFor(found.graph, found.node, slot))
    )
  }

  return Object.freeze({
    get length() {
      const found = live()
      return found && side.slotsOf(found.node).length
    },
    at(index: number) {
      if (!Number.isSafeInteger(index) || index < 0) {
        throw invalidArgument('at', 'a whole index of zero or more', index)
      }
      return handleWhere((slots) => (index < slots.length ? index : -1))
    },
    all,
    names() {
      const found = live()
      return (
        found && Object.freeze(side.slotsOf(found.node).map(({ name }) => name))
      )
    },
    byName(name: string) {
      if (typeof name !== 'string') {
        throw invalidArgument('byName', 'a slot name', name)
      }
      return handleWhere((slots) => onlyIndexNamed(slots, name))
    },
    byId(id: string) {
      if (typeof id !== 'string') throw invalidArgument('byId', 'a slot id', id)
      return handleWhere((slots) =>
        slots.findIndex((slot) => knownSlotId(slot) === id)
      )
    },
    [Symbol.iterator]: () => (all() ?? []).values(),
    add: side.add,
    remove(ref: SlotRef) {
      const checked = checkedSlotRef('remove', ref)
      const slot = handleWhere((slots) => slotIndexOf('remove', slots, checked))
      return slot !== undefined && side.remove(slot)
    },
    reorder: side.reorder
  })
}

function onlyIndexNamed(
  slots: readonly { readonly name: string }[],
  name: string
): number {
  const first = slots.findIndex((slot) => slot.name === name)
  const last = slots.findLastIndex((slot) => slot.name === name)
  return first === last ? first : -1
}
