import type { CloudNodeRegistryRevision } from '@comfyorg/ingest-types'
import type { MissingNodeType } from '@/types/comfy'
import { tryNormalizeNodeExecutionId } from '@/types/nodeIdentification'
import { flattenWorkflowNodes } from '@/platform/workflow/core/utils/workflowFlattening'
import type { FlattenableWorkflowGraph } from '@/platform/workflow/core/utils/workflowFlattening'
import { workflowPackCandidates } from './workflowPackCandidates'

export type UnresolvedWorkflowPack = {
  key: string
  name: string
  cnrId?: string
  auxId?: string
  version?: string
  nodeTypes: string[]
}

export function unresolvedWorkflowPacks(
  graph: FlattenableWorkflowGraph,
  missing: MissingNodeType[],
  revisions: readonly CloudNodeRegistryRevision[]
): UnresolvedWorkflowPack[] {
  const packs = new Map<string, UnresolvedWorkflowPack>()
  for (const node of flattenWorkflowNodes(graph)) {
    const issue = missing.find((item) => {
      if (typeof item === 'string') return item === node.type
      return (
        item.type === node.type &&
        (item.nodeId == null ||
          tryNormalizeNodeExecutionId(item.nodeId) ===
            tryNormalizeNodeExecutionId(node.id))
      )
    })
    if (!issue || workflowPackCandidates(node, revisions).length) continue
    const cnrId =
      typeof node.properties?.cnr_id === 'string'
        ? node.properties.cnr_id
        : typeof issue !== 'string'
          ? issue.cnrId
          : undefined
    if (cnrId === 'comfy-core') continue
    const auxId =
      typeof node.properties?.aux_id === 'string'
        ? node.properties.aux_id
        : undefined
    const version =
      typeof node.properties?.ver === 'string' ? node.properties.ver : undefined
    const key = JSON.stringify([
      cnrId,
      auxId,
      version,
      cnrId || auxId ? null : node.type
    ])
    const existing = packs.get(key)
    if (existing) {
      if (!existing.nodeTypes.includes(node.type))
        existing.nodeTypes.push(node.type)
    } else {
      packs.set(key, {
        key,
        name: cnrId || auxId || node.type,
        cnrId,
        auxId,
        version,
        nodeTypes: [node.type]
      })
    }
  }
  return [...packs.values()]
}
