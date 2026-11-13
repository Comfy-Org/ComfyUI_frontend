import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import {
  captureInputLayout,
  outputLinks,
  replaceNodeInputs
} from '@/lib/litegraph/src/node/slotLinks'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import { reorderSubgraphInputs } from '@/lib/litegraph/src/subgraph/subgraphUtils'
import { useLinkStore } from '@/stores/linkStore'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type { NodeHandles } from '@/platform/nodeApi/v4/nodeHandle'
import type {
  InputSlotHandle,
  OutputSlotHandle,
  SlotSide
} from '@/platform/nodeApi/v4/types'
import { checkedChoice } from './checkedArguments'
import type { EditRunner } from './editRunner'
import type { SlotHandles } from './liveSlot'
import { liveNodeOf } from './nodeEdits'
import { assertNotSubgraphNode, assertPositionShown } from './refusedEdits'
import {
  assertFitsNode,
  checkedSlotName,
  checkedSlotOptions,
  checkedSlotPatch,
  checkedSlotType
} from './slotPatch'

/** The slot edits, taking anything a pack passes and checking it. */
export interface SlotEdits {
  /** `member` names the call a refusal blames, for a handle method that calls this. */
  updateSlot(slot: unknown, patch: unknown, member?: string): boolean
  addInput(
    node: unknown,
    name: unknown,
    type: unknown,
    options?: unknown,
    member?: string
  ): InputSlotHandle | undefined
  addOutput(
    node: unknown,
    name: unknown,
    type: unknown,
    options?: unknown,
    member?: string
  ): OutputSlotHandle | undefined
  removeSlot(slot: unknown): boolean
  reorderSlots(
    node: unknown,
    side: unknown,
    names: unknown,
    member?: string
  ): boolean
}

const SIDES = { input: true, output: true } satisfies Record<SlotSide, true>

export function createSlotEdits(
  nodes: NodeHandles,
  slots: SlotHandles,
  runner: EditRunner
): SlotEdits {
  function checkedAddition(
    member: string,
    side: SlotSide,
    [node, name, type, options]: readonly unknown[]
  ) {
    const live = liveNodeOf(nodes, member, node)
    const slotName = checkedSlotName(member, name)
    const slotType = checkedSlotType(member, type)
    const extra = checkedSlotOptions(member, options, side)
    if (!live) return undefined
    assertNotSubgraphNode(member, live.node)
    assertFitsNode(member, live.node, side, {
      name: slotName,
      widget: extra.widget?.name
    })
    return { ...live, slotName, slotType, extra }
  }

  return {
    updateSlot(slot, patch, member = 'updateSlot') {
      const locator = slotLocatorOf(slots, member, slot)
      const checked = checkedSlotPatch(patch, locator.side, member)
      const live = locator.locate()
      if (!live) return false
      assertNotSubgraphNode(member, live.node)
      assertPositionShown(member, live, checked.fields, checked.widget)
      assertFitsNode(member, live.node, live.side, {
        name: checked.name,
        widget: checked.widget,
        except: live.slot
      })
      runner.apply(live.graph, () => {
        for (const write of checked.writes) write(live)
        if (checked.widget === null) delete live.slot.widget
        else if (checked.widget !== undefined) {
          live.slot.widget = { name: checked.widget }
        }
      })
      return true
    },

    addInput(node, name, type, options, member = 'addInput') {
      const adding = checkedAddition(member, 'input', [
        node,
        name,
        type,
        options
      ])
      if (!adding) return undefined
      const { graph, node: host, slotName, slotType, extra } = adding
      return runner.apply(graph, () =>
        slots.inputHandle(graph, host, host.addInput(slotName, slotType, extra))
      )
    },

    addOutput(node, name, type, options, member = 'addOutput') {
      const adding = checkedAddition(member, 'output', [
        node,
        name,
        type,
        options
      ])
      if (!adding) return undefined
      const { graph, node: host, slotName, slotType, extra } = adding
      return runner.apply(graph, () =>
        slots.outputHandle(
          graph,
          host,
          host.addOutput(slotName, slotType, extra)
        )
      )
    },

    removeSlot(slot) {
      const live = slotLocatorOf(slots, 'removeSlot', slot).locate()
      if (!live) return false
      assertNotSubgraphNode('removeSlot', live.node)
      runner.apply(live.graph, () => {
        if (live.side === 'input') live.node.removeInput(live.index)
        else live.node.removeOutput(live.index)
      })
      return true
    },

    reorderSlots(node, side, names, member = 'reorderSlots') {
      const live = liveNodeOf(nodes, member, node)
      const slotSide = checkedChoice(member, 'side', side, SIDES)
      const order = checkedNames(member, names)
      if (!live) return false
      const current =
        slotSide === 'input' ? live.node.inputs : live.node.outputs
      const moved = permutation(member, order, current)
      const { graph, node: host } = live
      if (host.isSubgraphNode() && slotSide === 'input') {
        return runner.apply(graph, () => {
          const reordered = reorderSubgraphNodeInputs(host, moved)
          if (reordered) moveFloatingLinks(graph, host, slotSide, moved)
          return reordered
        })
      }
      assertNotSubgraphNode(member, host)
      return runner.apply(graph, () => {
        const reordered =
          slotSide === 'input'
            ? reorderInputs(host, moved)
            : reorderOutputs(graph, host, moved)
        if (reordered) moveFloatingLinks(graph, host, slotSide, moved)
        return reordered
      })
    }
  }
}

/** For a slot handle, its locator; anything else throws. */
export function slotLocatorOf(
  slots: SlotHandles,
  member: string,
  handle: unknown
) {
  const locator = slots.locator(handle)
  if (!locator) throw invalidArgument(member, 'a slot handle', handle)
  return locator
}

function checkedNames(member: string, names: unknown): readonly string[] {
  if (
    !Array.isArray(names) ||
    !names.every((name): name is string => typeof name === 'string')
  ) {
    throw invalidArgument(member, 'a list of slot names', names)
  }
  return names
}

function permutation(
  member: string,
  order: readonly string[],
  slots: readonly { readonly name: string }[]
): readonly number[] {
  const indexByName = new Map(slots.map((slot, index) => [slot.name, index]))
  const from = order.map((name) => indexByName.get(name))
  if (
    order.length !== slots.length ||
    new Set(order).size !== order.length ||
    from.includes(undefined)
  ) {
    throw invalidArgument(
      member,
      `each of the slots' distinct names once (${slots.map(({ name }) => name).join(', ')})`,
      order.join(', ')
    )
  }
  return from.filter((index): index is number => index !== undefined)
}

function moveFloatingLinks(
  graph: LGraph,
  node: LGraphNode,
  side: SlotSide,
  from: readonly number[]
): void {
  for (const link of graph.floatingLinks.values()) {
    if (side === 'input' && link.target_id === node.id) {
      link.target_slot = from.indexOf(link.target_slot)
    } else if (side === 'output' && link.origin_id === node.id) {
      link.origin_slot = from.indexOf(link.origin_slot)
    }
  }
}

function reorderSubgraphNodeInputs(
  node: SubgraphNode,
  from: readonly number[]
): boolean {
  const before = [...node.inputs]
  reorderSubgraphInputs(node, from)
  return node.inputs.every((input, index) => input === before[from[index]])
}

function reorderInputs(node: LGraphNode, from: readonly number[]): boolean {
  const layout = captureInputLayout(node)
  const inputs = from.map((index) => layout.inputs[index])
  return replaceNodeInputs(node, layout, inputs).ok
}

function reorderOutputs(
  graph: LGraph,
  node: LGraphNode,
  from: readonly number[]
): boolean {
  const moves = from.flatMap((was, now) =>
    outputLinks(graph, node.id, was).map((link) => ({
      topology: link._state,
      patch: { originSlot: now }
    }))
  )
  const result = useLinkStore().updateEndpoints(graphScopeOf(graph), moves)
  if (!result.ok) return false
  const outputs = from.map((index) => node.outputs[index])
  node.outputs.splice(0, node.outputs.length, ...outputs)
  return true
}
