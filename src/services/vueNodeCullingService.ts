import { shallowRef } from 'vue'

const excludedNodeTypeCounts = new Map<string, number>()
const nodeTypeCullingOptOutVersion = shallowRef(0)

export function registerNodeTypeCullingOptOut(nodeType: string): () => void {
  const count = excludedNodeTypeCounts.get(nodeType) ?? 0
  excludedNodeTypeCounts.set(nodeType, count + 1)
  nodeTypeCullingOptOutVersion.value++

  let registered = true
  return () => {
    if (!registered) return
    registered = false

    const currentCount = excludedNodeTypeCounts.get(nodeType) ?? 0
    if (currentCount <= 1) excludedNodeTypeCounts.delete(nodeType)
    else excludedNodeTypeCounts.set(nodeType, currentCount - 1)
    nodeTypeCullingOptOutVersion.value++
  }
}

export function isNodeTypeExcludedFromCulling(nodeType: string): boolean {
  void nodeTypeCullingOptOutVersion.value
  return excludedNodeTypeCounts.has(nodeType)
}

/** Bumps on every registration change; watch it to re-evaluate exclusions. */
export function getCullingOptOutVersion(): number {
  return nodeTypeCullingOptOutVersion.value
}
