import type { LinkId } from '@/types/linkId'
import type { NodeId } from '@/types/nodeId'
import type { RerouteId } from '@/types/rerouteId'
import type { UUID } from '@/utils/uuid'

import type { LGraphNode } from '../LGraphNode'
import type { LLink } from '../LLink'
import type { Reroute } from '../Reroute'
import type { SubgraphInputNode } from '../subgraph/SubgraphInputNode'
import type { SubgraphOutputNode } from '../subgraph/SubgraphOutputNode'

export interface ReadonlyLinkNetwork {
  readonly rootGraph: { readonly id: UUID }
  readonly links: ReadonlyMap<LinkId, LLink>
  readonly reroutes: ReadonlyMap<RerouteId, Reroute>
  readonly floatingLinks: ReadonlyMap<LinkId, LLink>
  getNodeById(id: NodeId | null | undefined): LGraphNode | null
  getLink(id: null | undefined): undefined
  getLink(id: LinkId | null | undefined): LLink | undefined
  getReroute(parentId: null | undefined): undefined
  getReroute(parentId: RerouteId | null | undefined): Reroute | undefined

  readonly inputNode?: SubgraphInputNode
  readonly outputNode?: SubgraphOutputNode
}

/**
 * Contains a list of links, reroutes, and nodes.
 */
export interface LinkNetwork extends ReadonlyLinkNetwork {
  readonly links: Map<LinkId, LLink>
  readonly reroutes: Map<RerouteId, Reroute>
  addFloatingLink(link: LLink): LLink | undefined
  removeReroute(id: RerouteId): unknown
  /** Removes a reroute from the map and its stores, without chain splicing. */
  _removeReroute(id: RerouteId): void
  removeFloatingLink(link: LLink): void
}

/**
 * Locates graph items.
 */
export interface ItemLocator {
  getNodeOnPos(x: number, y: number, nodeList?: LGraphNode[]): LGraphNode | null
  getRerouteOnPos(x: number, y: number): Reroute | undefined
  getIoNodeOnPos?(
    x: number,
    y: number
  ): SubgraphInputNode | SubgraphOutputNode | undefined
}
