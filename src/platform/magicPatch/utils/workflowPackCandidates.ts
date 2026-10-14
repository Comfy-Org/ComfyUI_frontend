import type { CloudNodeRegistryRevision } from '@comfyorg/ingest-types'
import { collectSubgraphDefinitions } from '@/platform/workflow/core/utils/workflowFlattening'
import type { FlattenableWorkflowNode } from '@/platform/workflow/core/utils/workflowFlattening'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

type NodeIdentity = Pick<FlattenableWorkflowNode, 'type' | 'properties'>
export type WorkflowPackBinding = {
  scope: string | null
  id: FlattenableWorkflowNode['id']
  type: string
  sourcePackId: string
  sourceRevisionId: string
}

export function workflowPackCandidates(
  node: NodeIdentity,
  revisions: readonly CloudNodeRegistryRevision[]
): CloudNodeRegistryRevision[] {
  const pack =
    typeof node.properties?.cnr_id === 'string'
      ? node.properties.cnr_id
      : undefined
  const version =
    typeof node.properties?.ver === 'string' ? node.properties.ver : undefined
  const matches = revisions.filter((revision) => {
    if (
      revision.node_api_version !== 1 ||
      !revision.upstream_commit ||
      !revision.nodes.includes(node.type)
    )
      return false
    if (
      pack &&
      pack !== revision.pack_id &&
      pack.replaceAll('_', '-') !==
        revision.pack_id.split('/')[0]?.replaceAll('_', '-')
    )
      return false
    if (version && /^[a-f0-9]{64}$/u.test(version))
      return version === revision.revision_id
    if (version && /^[a-f0-9]{40}$/u.test(version))
      return version === revision.upstream_commit
    return true
  })
  return matches.length === 1 ? matches : []
}

export function workflowPackBindings(
  graph: ComfyWorkflowJSON,
  revisions: readonly CloudNodeRegistryRevision[]
): WorkflowPackBinding[] {
  const scopes = [
    { scope: null, nodes: graph.nodes },
    ...collectSubgraphDefinitions(graph.definitions?.subgraphs ?? []).map(
      (definition) => ({ scope: definition.id, nodes: definition.nodes })
    )
  ]
  return scopes.flatMap(({ scope, nodes }) =>
    nodes.flatMap((node) =>
      workflowPackCandidates(node, revisions).map((revision) => ({
        scope,
        id: node.id,
        type: node.type,
        sourcePackId: revision.pack_id,
        sourceRevisionId: revision.revision_id
      }))
    )
  )
}
