import { vi } from 'vitest'

import type { getNodeByLocatorId as realGetNodeByLocatorId } from '@/utils/graphTraversalUtil'

export {
  collectAllNodes,
  collectFromNodes,
  executionIdFromState,
  executionIdToNodeLocatorId,
  findNodeInHierarchy,
  findSubgraphByUuid,
  findSubgraphNodePathById,
  findSubgraphPathById,
  forEachNode,
  forEachSubgraphNode,
  getActiveGraphNodeIds,
  getAllNonIoNodesInSubgraph,
  getExecutionIdByNode,
  getExecutionIdForNodeInGraph,
  getExecutionIdsForSelectedNodes,
  getLocalNodeIdFromExecutionId,
  getNodeByExecutionId,
  getRootGraph,
  getRootParentNode,
  getSubgraphPathFromExecutionId,
  isAncestorPathActive,
  isCandidateScopeActive,
  isExecutionPathActive,
  isMissingCandidateActive,
  locatorIdFromState,
  mapAllNodes,
  mapSubgraphNodes,
  mapUniqueNodes,
  parseExecutionId,
  reduceAllNodes,
  subgraphIdFromState,
  traverseNodesDepthFirst,
  traverseSubgraphPath,
  triggerCallbackOnAllNodes,
  visitGraphNodes
} from '@/utils/graphTraversalUtil'

export const getNodeByLocatorId = vi.fn<typeof realGetNodeByLocatorId>(
  () => null
)
