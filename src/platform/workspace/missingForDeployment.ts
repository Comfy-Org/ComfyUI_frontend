import { uniqBy } from 'es-toolkit'

import type { MissingModelCandidate } from '@/platform/workflowErrors/missingModel/types'
import type { MissingNodeType } from '@/platform/workflowErrors/nodeReplacement/types'
import type {
  MissingBuildModel,
  MissingBuildPack
} from '@/platform/workspace/deploymentBuildBrief'

const CORE_PACK_ID = 'comfy-core'

/** The class name of a missing node type. */
export function missingNodeTypeName(nodeType: MissingNodeType): string {
  return typeof nodeType === 'string' ? nodeType : nodeType.type
}

/** Missing custom node types the editor found no replacement for, which only their pack can run. */
export function nodesNeedingDeployment(
  nodeTypes: readonly MissingNodeType[]
): MissingNodeType[] {
  return nodeTypes.filter(
    (nodeType) =>
      typeof nodeType !== 'string' &&
      nodeType.isReplaceable === false &&
      nodeType.cnrId !== CORE_PACK_ID
  )
}

/** Missing node types by registry pack, with unknown-pack types last. */
export function missingPacksOf(
  nodeTypes: readonly MissingNodeType[]
): MissingBuildPack[] {
  const byPack = new Map<string | null, string[]>()
  for (const nodeType of nodeTypes) {
    const packId = typeof nodeType === 'string' ? null : nodeType.cnrId || null
    const names = byPack.get(packId) ?? []
    const name = missingNodeTypeName(nodeType)
    if (!names.includes(name)) byPack.set(packId, [...names, name])
  }
  return [...byPack]
    .map(([packId, names]) => ({ packId, nodeTypes: names }))
    .sort((a, b) => Number(a.packId === null) - Number(b.packId === null))
}

/** Missing models as a deployment needs them: each file once per models folder. */
export function missingModelsOf(
  candidates: readonly MissingModelCandidate[]
): MissingBuildModel[] {
  return uniqBy(
    candidates,
    (candidate) => `${candidate.directory ?? ''}/${candidate.name}`
  ).map((candidate) => ({
    name: candidate.name,
    directory: candidate.directory ?? null,
    url: candidate.url
  }))
}
