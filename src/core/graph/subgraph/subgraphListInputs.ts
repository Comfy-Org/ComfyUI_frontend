import type {
  ResolvedConnection,
  Subgraph,
  SubgraphInput,
  SubgraphNode
} from '@comfyorg/graph-model/entityRegistry'
import {
  captureInputLayout,
  replaceNodeInputs
} from '@/lib/litegraph/src/node/slotLinks'
import { hostInputsOf } from '@/lib/litegraph/src/subgraph/listInputs'
import { nextUniqueName } from '@/lib/litegraph/src/strings'
import type { INodeInputSlot } from '@comfyorg/graph-model/slots'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { NodeSlotType } from '@comfyorg/graph-model/globalEnums'
import {
  applyAutogrowTemplate,
  listTemplateAt,
  withComfyAutogrow
} from '@/core/graph/widgets/dynamicWidgets'

/**
 * Shows each list input of `host` as the autogrow group it feeds, with the
 * same minimum and maximum, and each other input as a single slot.
 */
export function syncListInputs(host: SubgraphNode) {
  // Wire autogrow from the start: hooks added later save and restore the
  // node's callbacks, which would drop a handler chained after them
  withComfyAutogrow(host)
  for (const input of host.subgraph.inputs) {
    const slots = hostInputsOf(host, input)
    // A list's slots are named `<input>[].<item>`; a single slot is `<input>`
    const isGroup = slots.some((slot) => slot.name !== input.name)
    if (input.list && !isGroup) {
      const target = innerTarget(host.subgraph, input)
      const template = target && listTemplateAt(...target)
      if (!template) continue
      applyAutogrowTemplate(host, `${input.name}[]`, template)
      replaceSlots(host, slots, hostInputsOf(host, input).slice(slots.length))
    } else if (!input.list && isGroup) {
      host.addInput(input.name, input.type, { _subgraphSlot: input })
      replaceSlots(host, slots, [host.inputs.at(-1)!])
    } else if (input.list) {
      replaceSlots(host, slots, slots) // a load can put list items at the end
    }
  }
}

function innerTarget(subgraph: Subgraph, input: SubgraphInput) {
  const link = subgraph.getLink(input.linkIds[0])
  const { inputNode, input: slot } = link?.resolve(subgraph) ?? {}
  return inputNode && slot
    ? ([inputNode, inputNode.inputs.indexOf(slot)] as const)
    : undefined
}

/** Puts `to` where `from` starts, in place of it, moving its first link over. */
function replaceSlots(
  host: SubgraphNode,
  from: INodeInputSlot[],
  to: INodeInputSlot[]
) {
  const previous = captureInputLayout(host)
  const at = host.inputs.indexOf(from[0] ?? to[0])
  const kept = host.inputs.filter((i) => !from.includes(i) && !to.includes(i))
  const before = host.inputs.slice(0, at).filter((i) => kept.includes(i))
  kept.splice(before.length, 0, ...to)
  const links = new Map(previous.links)
  const carried = links.get(from[0])
  if (carried && !links.has(to[0])) links.set(to[0], carried)
  if (to[0] !== from[0]) links.delete(from[0])
  if (!replaceNodeInputs(host, previous, kept, links).ok || !carried) return
  // Let the group grow past the slot that took the link
  const slot = host.inputs.indexOf(to[0])
  host.onConnectionsChange?.(NodeSlotType.INPUT, slot, true, carried, to[0])
}

/**
 * After converting to a subgraph, merges the inputs that feed consecutive
 * slots of one autogrow group, from its first, into one list input.
 */
export function mergeListRuns(host: SubgraphNode) {
  const { subgraph } = host
  const target = (input: SubgraphInput) =>
    input.linkIds.length === 1 ? innerTarget(subgraph, input) : undefined
  const feeding = (node: LGraphNode, name: string) =>
    subgraph.inputs.find((input) => {
      const [n, slot] = target(input) ?? []
      return n === node && node.inputs[slot!].name === name
    })
  const bySlot = (input: SubgraphInput) => target(input)?.[1] ?? -1
  const runs: {
    anchor: SubgraphInput
    sources: (ResolvedConnection | null | undefined)[]
  }[] = []
  for (const anchor of [...subgraph.inputs].sort(
    (a, b) => bySlot(a) - bySlot(b)
  )) {
    const [node, slot] = target(anchor) ?? []
    const names = node?.getListSlotNames?.(slot!)
    if (!node || !names || !subgraph.inputs.includes(anchor)) continue
    const inputs: SubgraphInput[] = []
    for (const next of names.map((name) => feeding(node, name))) {
      if (!next) break
      inputs.push(next)
    }
    const fedAfter = names
      .slice(inputs.length)
      .some((name) => node.inputs.find((i) => i.name === name)?.link != null)
    if (fedAfter) continue
    // Keep the first input as the list, and move the others' sources onto it
    const sources = inputs.map((input) => {
      const link = host.graph?.getLink(hostInputsOf(host, input)[0]?.link)
      return host.graph && link?.resolve(host.graph)
    })
    for (const input of inputs.slice(1)) subgraph.removeInput(input)
    // Rename now: a group's new slots adopt any slot already named like them
    const group = names[0]
      .slice(0, names[0].lastIndexOf('.'))
      .replace(/\[\]$/, '')
    const others = subgraph.inputs.filter((i) => i !== anchor)
    anchor.name = nextUniqueName(
      group,
      others.map((i) => i.name)
    )
    for (const slot of hostInputsOf(host, anchor)) slot.name = anchor.name
    anchor.localized_name = anchor.label = undefined
    runs.push({ anchor, sources })
  }
  // Removals and renames first: autogrow reads a disconnect right after a
  // connect on the same slot as a link swap
  for (const { anchor, sources } of runs) {
    subgraph.setInputList(anchor, { list: true })
    for (const [item, source] of sources.entries()) {
      const slotIndex = host.inputs.indexOf(hostInputsOf(host, anchor)[item])
      if (item === 0 || !source || slotIndex === -1) continue
      if (source.subgraphInput)
        source.subgraphInput.connect(host.inputs[slotIndex], host)
      else source.outputNode?.connect(source.link.origin_slot, host, slotIndex)
    }
  }
}
