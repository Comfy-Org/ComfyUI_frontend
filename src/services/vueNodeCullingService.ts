import { shallowReactive } from 'vue'

const excludedNodeTypeCounts = shallowReactive(new Map<string, number>())

export function registerNodeTypeCullingOptOut(nodeType: string): () => void {
  const count = excludedNodeTypeCounts.get(nodeType) ?? 0
  excludedNodeTypeCounts.set(nodeType, count + 1)

  let registered = true
  return () => {
    if (!registered) return
    registered = false

    const currentCount = excludedNodeTypeCounts.get(nodeType) ?? 0
    if (currentCount <= 1) excludedNodeTypeCounts.delete(nodeType)
    else excludedNodeTypeCounts.set(nodeType, currentCount - 1)
  }
}

export function isNodeTypeExcludedFromCulling(nodeType: string): boolean {
  return excludedNodeTypeCounts.has(nodeType)
}

export function getCullingOptOuts() {
  return { nodeTypes: [...excludedNodeTypeCounts.keys()] }
}
