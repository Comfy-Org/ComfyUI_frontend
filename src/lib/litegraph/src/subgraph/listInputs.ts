import type {
  LGraphNode,
  Subgraph,
  SubgraphInput,
  SubgraphNode
} from '@comfyorg/graph-model/entityRegistry'
import { NodeSlotType } from '@comfyorg/graph-model/globalEnums'

import { SUBGRAPH_INPUT_ID } from '@/lib/litegraph/src/constants'

/**
 * A list subgraph input feeds a whole dynamic input group (e.g. an autogrow
 * input) through one link into one of its slots. Each subgraph node shows it
 * as that same group (set up by the app layer), and prompt flattening expands
 * the fed slot into one input per item.
 */

/**
 * The names a list fed into `slot` of `node` fills, if it can take one: the
 * slot is in a dynamic group and nothing feeds the group after it.
 */
export function listableNames(
  node: LGraphNode,
  slot: number
): string[] | undefined {
  const names = node.getListSlotNames?.(slot)
  const later = new Set(names?.slice(1))
  const fedLater = node.inputs.some(
    (input) => later.has(input.name) && input.link != null
  )
  return fedLater ? undefined : names
}

/** The slots of `host` that show `input`: one, or a dynamic group for a list. */
export function hostInputsOf(
  host: SubgraphNode,
  input: SubgraphInput
): SubgraphNode['inputs'] {
  return host.inputs.filter((slot) => slot._subgraphSlot === input)
}

/** Re-announces `input`'s links, so the group it feeds sees whether it is a list. */
export function notifyListTargets(subgraph: Subgraph, input: SubgraphInput) {
  for (const linkId of input.linkIds) {
    const link = subgraph.getLink(linkId)
    const { inputNode, input: slot } = link?.resolve(subgraph) ?? {}
    if (!link || !inputNode || !slot) continue
    const index = inputNode.inputs.indexOf(slot)
    inputNode.onConnectionsChange?.(NodeSlotType.INPUT, index, true, link, slot)
  }
}

/** The list input of the enclosing subgraph feeding `slot` of `node`, if any. */
export function listSourceOf(
  node: LGraphNode,
  slot: number
): SubgraphInput | undefined {
  const { graph } = node
  const link = graph?.getLink(node.inputs.at(slot)?.link)
  if (!graph || graph.isRootGraph || link?.origin_id !== SUBGRAPH_INPUT_ID)
    return undefined
  const source = (graph as Subgraph).inputs.at(link.origin_slot)
  return source?.list ? source : undefined
}

/** Whether `input` can be a list: it has one link, into a slot that can take one. */
export function canBeList(subgraph: Subgraph, input: SubgraphInput): boolean {
  const link = input.linkIds.length === 1 && subgraph.getLink(input.linkIds[0])
  const { inputNode, input: slot } = link ? link.resolve(subgraph) : {}
  return !!(
    slot &&
    inputNode?.inputs &&
    listableNames(inputNode, inputNode.inputs.indexOf(slot))
  )
}
