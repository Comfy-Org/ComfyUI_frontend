import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { SubgraphInput } from '@/lib/litegraph/src/subgraph/SubgraphInput'

type SubgraphInputLinkContext = {
  inputNode: LGraphNode
  targetInput: INodeInputSlot
  getTargetWidget: () => ReturnType<LGraphNode['getWidgetFromSlot']>
}

/**
 * Resolves the interior link of a subgraph input.
 *
 * Accepts either the input name or the concrete `SubgraphInput` slot. Pass the
 * slot whenever the caller holds it: string lookup is first-match only, so
 * resolving by name silently walks the wrong slot's links when subgraph inputs
 * share a name (user rename or imported graph).
 */
export function resolveSubgraphInputLink<TResult>(
  node: LGraphNode,
  input: string | SubgraphInput,
  resolve: (context: SubgraphInputLinkContext) => TResult | undefined
): TResult | undefined {
  if (!node.isSubgraphNode()) return undefined

  const inputSlot =
    typeof input === 'string'
      ? node.subgraph.inputNode.slots.find((slot) => slot.name === input)
      : input
  if (!inputSlot) return undefined

  // Iterate forward so the first connected source is the promoted representative.
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
