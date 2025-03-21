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

type LinkExtension = {
  id: number
  parentId: number
}

type RerouteEntry = {
  reroute: Reroute
  rerouteNode: RerouteNode
}

/**
 * Identifies all legacy Reroute nodes in a workflow
 */
function findLegacyRerouteNodes(workflow: WorkflowJSON04): RerouteNode[] {
  return workflow.nodes.filter(
    (node) => node.type === 'Reroute'
  ) as RerouteNode[]
}

/**
 * Gets the center position of a node
 */
function getNodeCenter(node: ComfyNode): [number, number] {
  return [node.pos[0] + node.size[0] / 2, node.pos[1] + node.size[1] / 2]
}

/**
 * Creates native reroute points from legacy Reroute nodes
 */
export function createReroutePoints(
  rerouteNodes: RerouteNode[]
): Map<NodeId, RerouteEntry> {
  const rerouteMap = new Map<NodeId, RerouteEntry>()

  let rerouteIdCounter = 1
  rerouteNodes.forEach((node) => {
    const rerouteId = rerouteIdCounter++
    rerouteMap.set(node.id, {
      reroute: {
        id: rerouteId,
        pos: getNodeCenter(node),
        linkIds: []
      },
      rerouteNode: node
    })
  })

  return rerouteMap
}

/**
 * Creates new links and link extensions for the migrated workflow
 */
export function createNewLinks(
  workflow: WorkflowJSON04,
  rerouteMap: Map<NodeId, RerouteEntry>
): {
  links: ComfyLink[]
  linkExtensions: LinkExtension[]
} {
  const links: ComfyLink[] = []
  const linkExtensions: LinkExtension[] = []

  const rerouteMapByRerouteId = new Map<number, RerouteEntry>(
    Array.from(rerouteMap.values()).map((entry) => [entry.reroute.id, entry])
  )
  const linksMap = new Map<number, ComfyLink>(
    Array.from(workflow.links).map((link) => [link[0], link])
  )

  // Process each link in the workflow
  for (const link of workflow.links) {
    const [
      linkId,
      sourceNodeId,
      _sourceSlot,
      targetNodeId,
      _targetSlot,
      _dataType
    ] = link

    // Check if this link connects to or from a reroute node
    const sourceEntry = rerouteMap.get(sourceNodeId)
    const targetEntry = rerouteMap.get(targetNodeId)
    const sourceIsReroute = !!sourceEntry
    const targetIsReroute = !!targetEntry

    if (!sourceIsReroute && !targetIsReroute) {
      // If neither end is a reroute, keep the link as is
      links.push(link)
    } else if (sourceIsReroute && !targetIsReroute) {
      // This is a link from a reroute node to a regular node
      linkExtensions.push({
        id: linkId,
        parentId: sourceEntry.reroute.id
      })
    } else if (sourceIsReroute && targetIsReroute) {
      targetEntry.reroute.parentId = sourceEntry.reroute.id
    }
  }

  // Populate linkIds on reroute nodes
  for (const linkExtension of linkExtensions) {
    let entry = rerouteMapByRerouteId.get(linkExtension.parentId)

    while (entry) {
      const reroute = entry.reroute
      reroute.linkIds ??= []
      reroute.linkIds.push(linkExtension.id)

      if (reroute.parentId) {
        entry = rerouteMapByRerouteId.get(reroute.parentId)
      } else {
        const rerouteNode = entry.rerouteNode
        const rerouteInputLink = linksMap.get(
          rerouteNode?.inputs?.[0]?.link ?? -1
        )
        const rerouteOutputLink = linksMap.get(linkExtension.id)

        if (rerouteInputLink && rerouteOutputLink) {
          const [_, sourceNodeId, sourceSlot] = rerouteInputLink
          const [linkId, __, ___, targetNodeId, targetSlot, dataType] =
            rerouteOutputLink

          links.push([
            linkId,
            sourceNodeId,
            sourceSlot,
            targetNodeId,
            targetSlot,
            dataType
          ])
        }
        entry = undefined
      }
    }
  }

  return { links, linkExtensions }
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
  const rerouteMap = createReroutePoints(legacyRerouteNodes)

  // Create new links and link extensions
  const { links, linkExtensions } = createNewLinks(workflow, rerouteMap)

  // Update the workflow
  newWorkflow.links = links
  newWorkflow.nodes = newWorkflow.nodes.filter(
    (node) => node.type !== 'Reroute'
  )
  newWorkflow.extra.reroutes = Array.from(rerouteMap.values()).map(
    (entry) => entry.reroute
  )
  newWorkflow.extra.linkExtensions = linkExtensions

  return newWorkflow
}
