import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useNodeDefStore } from '@/stores/nodeDefStore'

/** TODO: Dedup with canEnhancePromptOnNode once #21632 lands. */
export function isPartnerApiNode(
  node: LGraphNode | null | undefined
): boolean {
  if (!node) return false
  return (
    useNodeDefStore().fromLGraphNode(node)?.api_node === true ||
    node.constructor.nodeData?.api_node === true
  )
}
