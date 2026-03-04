import { calculateNodeBounds } from '@/renderer/core/spatial/boundsCalculator'
import type { PositionedNode } from '@/renderer/core/spatial/boundsCalculator'

import type {
  IMinimapDataSource,
  MinimapBounds,
  MinimapGroupData,
  MinimapLinkData,
  MinimapNodeData
} from '../types'

export interface WorkflowJsonInput {
  nodes?: Array<{
    id: number | string
    pos: [number, number]
    size: [number, number]
    bgcolor?: string
    mode?: number
  }>
  groups?: Array<{
    bounding: [number, number, number, number]
    color?: string
  }>
  links?: unknown[]
}

export class WorkflowJsonDataSource implements IMinimapDataSource {
  private readonly nodes: MinimapNodeData[]
  private readonly groups: MinimapGroupData[]
  private readonly links: MinimapLinkData[]

  constructor(json: WorkflowJsonInput) {
    this.nodes = this.parseNodes(json.nodes)
    this.groups = this.parseGroups(json.groups)
    this.links = this.parseLinks(json.links, this.nodes)
  }

  getNodes(): MinimapNodeData[] {
    return this.nodes
  }

  getGroups(): MinimapGroupData[] {
    return this.groups
  }

  getLinks(): MinimapLinkData[] {
    return this.links
  }

  getBounds(): MinimapBounds {
    if (this.nodes.length === 0) {
      return {
        minX: 0,
        minY: 0,
        maxX: 100,
        maxY: 100,
        width: 100,
        height: 100
      }
    }
    const compatibleNodes = this.nodes.map(
      (node): PositionedNode => ({
        pos: [node.x, node.y],
        size: [node.width, node.height]
      })
    )
    return (
      calculateNodeBounds(compatibleNodes) ?? {
        minX: 0,
        minY: 0,
        maxX: 100,
        maxY: 100,
        width: 100,
        height: 100
      }
    )
  }

  getNodeCount(): number {
    return this.nodes.length
  }

  hasData(): boolean {
    return this.nodes.length > 0
  }

  private parseNodes(rawNodes?: WorkflowJsonInput['nodes']): MinimapNodeData[] {
    if (!rawNodes) return []
    return rawNodes.map((node) => ({
      id: String(node.id),
      x: node.pos[0],
      y: node.pos[1],
      width: node.size[0],
      height: node.size[1],
      bgcolor: node.bgcolor,
      mode: node.mode
    }))
  }

  private parseGroups(
    rawGroups?: WorkflowJsonInput['groups']
  ): MinimapGroupData[] {
    if (!rawGroups) return []
    return rawGroups.map((group) => ({
      x: group.bounding[0],
      y: group.bounding[1],
      width: group.bounding[2],
      height: group.bounding[3],
      color: group.color
    }))
  }

  private parseLinks(
    rawLinks: unknown[] | undefined,
    nodes: MinimapNodeData[]
  ): MinimapLinkData[] {
    if (!rawLinks || rawLinks.length === 0) return []
    const nodeMap = new Map(nodes.map((node) => [String(node.id), node]))
    const links: MinimapLinkData[] = []

    for (const link of rawLinks) {
      if (Array.isArray(link)) {
        // SerialisedLLinkArray: [id, origin_id, origin_slot, target_id, target_slot, type]
        const originId = String(link[1])
        const originSlot = link[2] as number
        const targetId = String(link[3])
        const targetSlot = link[4] as number
        const sourceNode = nodeMap.get(originId)
        const targetNode = nodeMap.get(targetId)
        if (sourceNode && targetNode) {
          links.push({
            sourceNode,
            targetNode,
            sourceSlot: originSlot,
            targetSlot
          })
        }
      } else if (link && typeof link === 'object') {
        // Object format: { origin_id, origin_slot, target_id, target_slot }
        const obj = link as Record<string, unknown>
        const sourceNode = nodeMap.get(String(obj.origin_id))
        const targetNode = nodeMap.get(String(obj.target_id))
        if (sourceNode && targetNode) {
          links.push({
            sourceNode,
            targetNode,
            sourceSlot: obj.origin_slot as number,
            targetSlot: obj.target_slot as number
          })
        }
      }
    }
    return links
  }
}
