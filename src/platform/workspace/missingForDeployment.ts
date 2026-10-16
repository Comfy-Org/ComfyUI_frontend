import type { MissingNodeType } from '@/platform/nodeReplacement/types'
import type { MissingBuildPack } from '@/platform/workspace/deploymentBuildBrief'

/** The class name of a missing node type. */
export function missingNodeTypeName(nodeType: MissingNodeType): string {
  return typeof nodeType === 'string' ? nodeType : nodeType.type
}

/** The missing node types only a deployment with their pack can run: those with no replacement. */
export function nodesNeedingDeployment(
  nodeTypes: readonly MissingNodeType[]
): MissingNodeType[] {
  return nodeTypes.filter(
    (nodeType) => typeof nodeType === 'string' || !nodeType.isReplaceable
  )
}

/** Groups missing node types by the registry pack that has them; node types with no known pack come last, under null. */
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
