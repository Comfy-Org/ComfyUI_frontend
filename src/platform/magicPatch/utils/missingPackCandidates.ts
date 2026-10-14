import type { CloudNodeRegistryRevision } from '@comfyorg/ingest-types'
import type { MissingPackGroup } from '@/components/rightSidePanel/errors/useErrorGroups'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { tryNormalizeNodeExecutionId } from '@/types/nodeIdentification'
import {
  collectAllNodes,
  getNodeByExecutionId
} from '@/utils/graphTraversalUtil'
import {
  convertedWorkflowPackCandidates,
  workflowPackCandidates
} from './workflowPackCandidates'

export function missingPackCandidates(
  rootGraph: LGraph,
  groups: MissingPackGroup[],
  revisions: readonly CloudNodeRegistryRevision[],
  apiVersion: 1 | 2 = 1
): CloudNodeRegistryRevision[] {
  const allNodes = collectAllNodes(rootGraph)
  let complete = true
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
      const matchingNodes = nodes.filter((node) => {
        const type = node.last_serialization?.type ?? node.type
        return type === expectedType
      })
      if (!matchingNodes.length) complete = false
      return matchingNodes.flatMap((node) => {
        const candidates = (
          apiVersion === 2
            ? convertedWorkflowPackCandidates
            : workflowPackCandidates
        )({ type: expectedType, properties: node.properties }, revisions)
        if (!candidates.length) complete = false
        return candidates
      })
    })
  )
  if (apiVersion === 2 && !complete) return []
  return [
    ...new Map(
      matches.map((revision) => [revision.revision_id, revision])
    ).values()
  ]
}
