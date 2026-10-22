import type { MissingNodeType } from '@/platform/workflowErrors/nodeReplacement/types'
import type { MissingBuildPack } from '@/platform/workspace/deploymentBuildBrief'

/** The class name of a missing node type. */
export function missingNodeTypeName(nodeType: MissingNodeType): string {
  return typeof nodeType === 'string' ? nodeType : nodeType.type
}

/** Missing node types with no replacement, which only their pack can run. */
export function nodesNeedingDeployment(
  nodeTypes: readonly MissingNodeType[]
): MissingNodeType[] {
  return nodeTypes.filter(
    (nodeType) => typeof nodeType === 'string' || !nodeType.isReplaceable
  )
}

/** Missing node types by registry pack, with unknown-pack types last. */
export function missingPacksOf(
  nodeTypes: readonly MissingNodeType[]
): MissingBuildPack[] {
  const byPack = new Map<string | null, string[]>()
  for (const nodeType of nodeTypes) {
    const packId =
      typeof nodeType === 'string' ? null : (nodeType.cnrId ?? null)
    const names = byPack.get(packId) ?? []
    const name = missingNodeTypeName(nodeType)
    if (!names.includes(name)) byPack.set(packId, [...names, name])
  }
  return [...byPack]
    .map(([packId, names]) => ({ packId, nodeTypes: names }))
    .sort((a, b) => Number(a.packId === null) - Number(b.packId === null))
}
