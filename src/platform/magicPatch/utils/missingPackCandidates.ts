import type { CloudNodeRegistryRevision } from '@comfyorg/ingest-types'
import type { MissingPackGroup } from '@/components/rightSidePanel/errors/useErrorGroups'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { tryNormalizeNodeExecutionId } from '@/types/nodeIdentification'
import {
  collectAllNodes,
  getNodeByExecutionId
} from '@/utils/graphTraversalUtil'
import { workflowPackCandidates } from './workflowPackCandidates'

export function missingPackCandidates(
  rootGraph: LGraph,
  groups: MissingPackGroup[],
  revisions: readonly CloudNodeRegistryRevision[]
): CloudNodeRegistryRevision[] {
  const allNodes = collectAllNodes(rootGraph)
  const matches = groups.flatMap((group) =>
    group.nodeTypes.flatMap((missing) => {
      const expectedType = typeof missing === 'string' ? missing : missing.type
      const nodes = (() => {
        if (typeof missing === 'string' || missing.nodeId == null)
          return allNodes
        const executionId = tryNormalizeNodeExecutionId(missing.nodeId)
        const node = executionId
          ? getNodeByExecutionId(rootGraph, executionId)
          : null
        return node ? [node] : []
      })()
      return nodes.flatMap((node) => {
        const type = node.last_serialization?.type ?? node.type
        if (!type || type !== expectedType) return []
        return workflowPackCandidates(
          { type, properties: node.properties },
          revisions
        )
      })
    })
  )
  return [
    ...new Map(
      matches.map((revision) => [revision.revision_id, revision])
    ).values()
  ]
}
