import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

type SubgraphInputLinkContext = {
  inputNode: LGraphNode
  targetInput: INodeInputSlot
  getTargetWidget: () => ReturnType<LGraphNode['getWidgetFromSlot']>
}

export function resolveSubgraphInputLink<TResult>(
  node: LGraphNode,
  inputName: string,
  resolve: (context: SubgraphInputLinkContext) => TResult | undefined
): TResult | undefined {
  if (!node.isSubgraphNode()) return undefined

  const inputSlot = node.subgraph.inputNode.slots.find(
    (slot) => slot.name === inputName
  )
  if (!inputSlot) return undefined

  // Iterate forward so the first connected source is the promoted representative,
  // matching SubgraphNode._resolveLinkedPromotionBySubgraphInput.
  for (const linkId of inputSlot.linkIds) {
    const link = node.subgraph.getLink(linkId)
    if (!link) continue

    const { inputNode } = link.resolve(node.subgraph)
    if (!inputNode) continue
    if (!Array.isArray(inputNode.inputs)) continue

    const targetInput = inputNode.inputs.find((entry) => entry.link === linkId)
    if (!targetInput) continue

    let cachedTargetWidget:
      | ReturnType<LGraphNode['getWidgetFromSlot']>
      | undefined
    let hasCachedTargetWidget = false

    const resolved = resolve({
      inputNode,
      targetInput,
      getTargetWidget: () => {
        if (!hasCachedTargetWidget) {
          cachedTargetWidget = inputNode.getWidgetFromSlot(targetInput)
          hasCachedTargetWidget = true
        }
        return cachedTargetWidget
      }
    })
    if (resolved !== undefined) return resolved
  }

  return undefined
}
