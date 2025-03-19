import type {
  ComfyLink,
  ComfyNode,
  NodeId,
  Reroute,
  WorkflowJSON04
} from '@/schemas/comfyWorkflowSchema'

type RerouteNode = ComfyNode & {
  type: 'Reroute'
}

/**
 * Identifies all legacy Reroute nodes in a workflow
 */
export function findLegacyRerouteNodes(
  workflow: WorkflowJSON04
): RerouteNode[] {
  return workflow.nodes.filter(
    (node) => node.type === 'Reroute'
  ) as RerouteNode[]
}

/**
 * Creates native reroute points from legacy Reroute nodes
 */
export function createReroutePoints(rerouteNodes: RerouteNode[]): {
  reroutes: Reroute[]
  rerouteIdMap: Map<NodeId, number>
} {
  const reroutes: Reroute[] = []
  const rerouteIdMap = new Map<NodeId, number>()

  let rerouteIdCounter = 1
  rerouteNodes.forEach((node) => {
    const rerouteId = rerouteIdCounter++
    rerouteIdMap.set(node.id, rerouteId)

    // Create a new reroute point
    const reroute: Reroute = {
      id: rerouteId,
      pos: node.pos,
      linkIds: []
    }

    reroutes.push(reroute)
  })

  return { reroutes, rerouteIdMap }
}

/**
 * Establishes parent-child relationships between reroutes
 */
export function establishRerouteRelationships(
  workflow: WorkflowJSON04,
  reroutes: Reroute[],
  rerouteIdMap: Map<NodeId, number>
): void {
  // Find links between reroute nodes
  for (const [
    _linkId,
    sourceNodeId,
    _sourceSlot,
    targetNodeId,
    _targetSlot,
    _dataType
  ] of workflow.links) {
    const sourceIsReroute = rerouteIdMap.has(sourceNodeId)
    const targetIsReroute = rerouteIdMap.has(targetNodeId)

    if (sourceIsReroute && targetIsReroute) {
      // This is a link between two reroutes
      const sourceRerouteId = rerouteIdMap.get(sourceNodeId)!
      const targetRerouteId = rerouteIdMap.get(targetNodeId)!

      // Update the target reroute to have a parent
      const targetReroute = reroutes.find((r) => r.id === targetRerouteId)!
      targetReroute.parentId = sourceRerouteId
    }
  }
}

/**
 * Finds all target nodes that a reroute connects to (directly or through child reroutes)
 */
export function findRerouteTargets(
  workflow: WorkflowJSON04,
  rerouteIdMap: Map<NodeId, number>,
  rerouteNodeId: NodeId
): Array<{ nodeId: NodeId; slot: number; dataType: string }> {
  const targets: Array<{ nodeId: NodeId; slot: number; dataType: string }> = []

  // Helper function to recursively find connections
  const findConnections = (nodeId: NodeId) => {
    for (const [
      _linkId,
      srcNodeId,
      _sourceSlot,
      tgtNodeId,
      targetSlot,
      dataType
    ] of workflow.links) {
      if (srcNodeId === nodeId) {
        if (rerouteIdMap.has(tgtNodeId)) {
          // This is a connection to another reroute, recurse
          findConnections(tgtNodeId)
        } else {
          // This is a connection to a regular node
          targets.push({
            nodeId: tgtNodeId,
            slot: targetSlot as number,
            dataType: dataType as string
          })
        }
      }
    }
  }

  findConnections(rerouteNodeId)
  return targets
}

/**
 * Creates new links and link extensions for the migrated workflow
 */
export function createNewLinks(
  workflow: WorkflowJSON04,
  reroutes: Reroute[],
  rerouteIdMap: Map<NodeId, number>
): {
  links: ComfyLink[]
  linkExtensions: { id: number; parentId: number }[]
  maxLinkId: number
} {
  const newLinks: ComfyLink[] = []
  const linkExtensions: { id: number; parentId: number }[] = []
  const processedLinks = new Set<number>()

  // Process each link in the workflow
  for (const link of workflow.links) {
    const [
      linkId,
      sourceNodeId,
      sourceSlot,
      targetNodeId,
      _targetSlot,
      _dataType
    ] = link

    // Check if this link connects to or from a reroute node
    const sourceIsReroute = rerouteIdMap.has(sourceNodeId)
    const targetIsReroute = rerouteIdMap.has(targetNodeId)

    if (!sourceIsReroute && !targetIsReroute) {
      // If neither end is a reroute, keep the link as is
      newLinks.push(link)
      continue
    }

    // Mark this link as processed
    processedLinks.add(linkId)

    if (!sourceIsReroute && targetIsReroute) {
      // This is a link from a regular node to a reroute
      const rerouteId = rerouteIdMap.get(targetNodeId)!

      // Find all nodes that this reroute connects to
      const targets = findRerouteTargets(workflow, rerouteIdMap, targetNodeId)

      // Create new direct links from the source to each target
      for (const {
        nodeId: tgtNodeId,
        slot: tgtSlot,
        dataType: dt
      } of targets) {
        const newLinkId = workflow.last_link_id + newLinks.length + 1
        newLinks.push([
          newLinkId,
          sourceNodeId,
          sourceSlot,
          tgtNodeId,
          tgtSlot,
          dt
        ])

        // Add this link to the reroute's linkIds
        const reroute = reroutes.find((r) => r.id === rerouteId)!
        if (!reroute.linkIds) {
          reroute.linkIds = []
        }
        reroute.linkIds.push(newLinkId)

        // Create a link extension
        linkExtensions.push({
          id: newLinkId,
          parentId: rerouteId
        })
      }
    }
  }

  // Calculate the maximum link ID
  const maxLinkId = Math.max(
    workflow.last_link_id,
    ...newLinks.map((link) => link[0])
  )

  return { links: newLinks, linkExtensions, maxLinkId }
}

/**
 * Main function to migrate legacy reroute nodes to native reroute points
 */
export const migrateLegacyRerouteNodes = (
  workflow: WorkflowJSON04
): WorkflowJSON04 => {
  // Find all legacy Reroute nodes
  const legacyRerouteNodes = findLegacyRerouteNodes(workflow)

  // If no reroute nodes, return the workflow unchanged
  if (legacyRerouteNodes.length === 0) {
    return workflow
  }

  // Create a deep copy of the workflow to avoid mutating the original
  const newWorkflow = JSON.parse(JSON.stringify(workflow)) as WorkflowJSON04

  // Initialize extra structure if needed
  if (!newWorkflow.extra) {
    newWorkflow.extra = {}
  }

  // Create native reroute points
  const { reroutes, rerouteIdMap } = createReroutePoints(legacyRerouteNodes)

  // Establish parent-child relationships between reroutes
  establishRerouteRelationships(workflow, reroutes, rerouteIdMap)

  // Create new links and link extensions
  const { links, linkExtensions, maxLinkId } = createNewLinks(
    workflow,
    reroutes,
    rerouteIdMap
  )

  // Update the workflow
  newWorkflow.links = links
  newWorkflow.nodes = newWorkflow.nodes.filter(
    (node) => node.type !== 'Reroute'
  )
  newWorkflow.extra.reroutes = reroutes
  newWorkflow.extra.linkExtensions = linkExtensions
  newWorkflow.last_link_id = maxLinkId

  return newWorkflow
}
