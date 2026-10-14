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
  if (convertedWorkflowPackCandidates(node, revisions).length) return []
  const matches = matchingWorkflowPackRevisions(node, revisions, 1)
  return matches.length === 1 ? matches : []
}

export function convertedWorkflowPackCandidates(
  node: NodeIdentity,
  revisions: readonly CloudNodeRegistryRevision[]
): CloudNodeRegistryRevision[] {
  const version = node.properties?.ver
  if (
    typeof version === 'string' &&
    !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(version)
  )
    return []
  return matchingWorkflowPackRevisions(node, revisions, 2)
}

function matchingWorkflowPackRevisions(
  node: NodeIdentity,
  revisions: readonly CloudNodeRegistryRevision[],
  apiVersion: 1 | 2
): CloudNodeRegistryRevision[] {
  const pack =
    typeof node.properties?.cnr_id === 'string'
      ? node.properties.cnr_id
      : typeof node.properties?.aux_id === 'string'
        ? node.properties.aux_id
            .replace(/\/+$/u, '')
            .replace(/\.git$/u, '')
            .split('/')
            .at(-1)
        : undefined
  const version =
    typeof node.properties?.ver === 'string' ? node.properties.ver : undefined
  const normalize = (value: string) => value.toLowerCase().replaceAll('_', '-')
  return revisions.filter((revision) => {
    if (
      revision.node_api_version !== apiVersion ||
      !revision.upstream_commit ||
      !revision.nodes.includes(node.type)
    )
      return false
    if (
      pack &&
      pack !== revision.pack_id &&
      normalize(pack) !== normalize(revision.pack_id.split('/')[0] ?? '')
    )
      return false
    if (version && /^[a-f0-9]{64}$/u.test(version))
      return version === revision.revision_id
    if (version && /^[a-f0-9]{40}$/u.test(version))
      return version === revision.upstream_commit
    return true
  })
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
