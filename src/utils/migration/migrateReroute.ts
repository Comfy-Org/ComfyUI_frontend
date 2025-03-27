import _ from 'lodash'

import type {
  ComfyLinkObject,
  ComfyNode,
  NodeId,
  Reroute,
  WorkflowJSON04
} from '@/schemas/comfyWorkflowSchema'

type RerouteNode = ComfyNode & {
  type: 'Reroute'
}

type ExtendedReroute = Reroute & {
  nodeId: NodeId
}

type LinkExtension = {
  id: number
  parentId: number
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

class ConversionContext {
  nodeById: Record<NodeId, ComfyNode>
  linkById: Record<number, ComfyLinkObject>
  rerouteById: Record<number, ExtendedReroute>
  rerouteByNodeId: Record<NodeId, ExtendedReroute>
  linkExtensions: LinkExtension[]

  constructor(public workflow: WorkflowJSON04) {
    this.nodeById = _.keyBy(
      workflow.nodes.filter((node) => node.type !== 'Reroute').map(_.cloneDeep),
      'id'
    )
    this.linkById = _.keyBy(
      workflow.links.map((l) => ({
        id: l[0],
        origin_id: l[1],
        origin_slot: l[2],
        target_id: l[3],
        target_slot: l[4],
        type: l[5]
      })),
      'id'
    )

    const reroutes = findLegacyRerouteNodes(workflow).map((node, index) => ({
      nodeId: node.id,
      id: index + 1,
      pos: getNodeCenter(node),
      linkIds: []
    }))

    this.rerouteByNodeId = _.keyBy(reroutes, 'nodeId')
    this.rerouteById = _.keyBy(reroutes, 'id')

    this.linkExtensions = []
  }

  /**
   * Gets the chain of reroute nodes leading to the given node
   */
  #getRerouteChain(node: RerouteNode): RerouteNode[] {
    const nodes: RerouteNode[] = []
    let currentNode: RerouteNode = node
    while (currentNode?.type === 'Reroute') {
      nodes.push(currentNode)
      const inputLink: ComfyLinkObject | undefined =
        this.linkById[currentNode.inputs?.[0]?.link ?? 0]

      if (!inputLink) {
        break
      }

      currentNode = this.nodeById[inputLink.origin_id] as RerouteNode
    }

    return nodes
  }

  #connectRerouteChain(rerouteNodes: RerouteNode[]): ExtendedReroute[] {
    const reroutes = rerouteNodes.map((node) => this.rerouteByNodeId[node.id])

    for (let i = 0; i < rerouteNodes.length - 1; i++) {
      const to = reroutes[i]
      const from = reroutes[i + 1]
      to.parentId = from.id
    }

    return reroutes
  }

  #createNewLink(
    startingLink: ComfyLinkObject,
    endingLink: ComfyLinkObject,
    rerouteNodes: RerouteNode[]
  ): ComfyLinkObject {
    if (rerouteNodes.length === 0) {
      throw new Error('No reroute nodes found')
    }

    const reroute = this.rerouteByNodeId[rerouteNodes[0].id]
    this.linkExtensions.push({
      id: endingLink.id,
      parentId: reroute.id
    })

    const reroutes = this.#connectRerouteChain(rerouteNodes)
    for (const reroute of reroutes) {
      reroute.linkIds ??= []
      reroute.linkIds.push(endingLink.id)
    }

    // Update source node's output slot's link ids to point to the new link.
    const sourceNode = this.nodeById[startingLink.origin_id]
    const outputSlot = sourceNode.outputs?.[startingLink.origin_slot]
    if (outputSlot) {
      outputSlot.links = outputSlot.links?.map((linkId) =>
        linkId === startingLink.id ? endingLink.id : linkId
      )
    }

    return {
      id: endingLink.id,
      origin_id: startingLink.origin_id,
      origin_slot: startingLink.origin_slot,
      target_id: endingLink.target_id,
      target_slot: endingLink.target_slot,
      type: endingLink.type
    }
  }

  #createNewInputFloatingLink(
    endingLink: ComfyLinkObject,
    rerouteNodes: RerouteNode[]
  ): ComfyLinkObject {
    const reroutes = this.#connectRerouteChain(rerouteNodes)
    for (const reroute of reroutes) {
      reroute.floating = {
        slotType: 'input'
      }
    }
    return {
      id: endingLink.id,
      origin_id: -1,
      origin_slot: -1,
      target_id: endingLink.target_id,
      target_slot: endingLink.target_slot,
      type: endingLink.type
    }
  }

  migrateReroutes(): WorkflowJSON04 {
    const links: ComfyLinkObject[] = []
    const floatingLinks: ComfyLinkObject[] = []

    const endingLinks: ComfyLinkObject[] = []

    for (const link of Object.values(this.linkById)) {
      const sourceIsReroute = !!this.rerouteByNodeId[link.origin_id]
      const targetIsReroute = !!this.rerouteByNodeId[link.target_id]

      // Process links that are not connected to reroute nodes
      if (!sourceIsReroute && !targetIsReroute) {
        links.push(link)
      } else if (sourceIsReroute && !targetIsReroute) {
        endingLinks.push(link)
      }
    }

    for (const endingLink of endingLinks) {
      const endingRerouteNode = this.nodeById[
        endingLink.origin_id
      ] as RerouteNode
      const rerouteNodes = this.#getRerouteChain(endingRerouteNode)
      const startingLink =
        this.linkById[
          rerouteNodes[rerouteNodes.length - 1]?.inputs?.[0]?.link ?? -1
        ]
      if (startingLink) {
        // Valid link found, create a new link
        links.push(this.#createNewLink(startingLink, endingLink, rerouteNodes))
      } else {
        // Floating link found, create a new floating link
        floatingLinks.push(
          this.#createNewInputFloatingLink(endingLink, rerouteNodes)
        )
      }
    }

    return {
      ...this.workflow,
      nodes: Object.values(this.nodeById),
      links: links.map((link) => [
        link.id,
        link.origin_id,
        link.origin_slot,
        link.target_id,
        link.target_slot,
        link.type
      ]),
      floatingLinks,
      extra: {
        ...this.workflow.extra,
        reroutes: Object.values(this.rerouteById),
        linkExtensions: this.linkExtensions
      }
    }
  }
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

  const context = new ConversionContext(newWorkflow)
  return context.migrateReroutes()
}
