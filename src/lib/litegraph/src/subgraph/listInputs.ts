import type {
  LGraphNode,
  Subgraph,
  SubgraphInput,
  SubgraphNode
} from '@comfyorg/graph-model/entityRegistry'
import { NodeSlotType } from '@comfyorg/graph-model/globalEnums'

// A list input feeds a whole dynamic group through one link; the app layer shows it as that group on each subgraph node
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

export function hostInputsOf(
  host: SubgraphNode,
  input: SubgraphInput
): SubgraphNode['inputs'] {
  return host.inputs.filter((slot) => slot._subgraphSlot === input)
}

export function notifyListTargets(subgraph: Subgraph, input: SubgraphInput) {
  for (const linkId of input.linkIds) {
    const link = subgraph.getLink(linkId)
    const { inputNode, input: slot } = link?.resolve(subgraph) ?? {}
    if (!link || !inputNode || !slot) continue
    const index = inputNode.inputs.indexOf(slot)
    inputNode.onConnectionsChange?.(NodeSlotType.INPUT, index, true, link, slot)
  }
}

export function canBeList(subgraph: Subgraph, input: SubgraphInput): boolean {
  const link = input.linkIds.length === 1 && subgraph.getLink(input.linkIds[0])
  const { inputNode, input: slot } = link ? link.resolve(subgraph) : {}
  return !!(
    slot &&
    inputNode?.inputs &&
    listableNames(inputNode, inputNode.inputs.indexOf(slot))
  )
}
