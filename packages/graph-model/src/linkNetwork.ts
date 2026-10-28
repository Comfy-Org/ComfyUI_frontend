import type {
  LGraphNode,
  LLink,
  Reroute,
  SubgraphInputNode,
  SubgraphOutputNode
} from './entityRegistry'
import type { LinkId } from './linkId'
import type { NodeId } from './nodeId'
import type { RerouteId } from './rerouteId'
import type { UUID } from './uuid'

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

export interface LinkNetwork extends ReadonlyLinkNetwork {
  readonly links: Map<LinkId, LLink>
  readonly reroutes: Map<RerouteId, Reroute>
  addFloatingLink(link: LLink): LLink | undefined
  removeReroute(id: RerouteId): unknown

  _removeReroute(id: RerouteId): void
  removeFloatingLink(link: LLink): void
}

export interface ItemLocator {
  getNodeOnPos(x: number, y: number, nodeList?: LGraphNode[]): LGraphNode | null
  getRerouteOnPos(x: number, y: number): Reroute | undefined
  getIoNodeOnPos?(
    x: number,
    y: number
  ): SubgraphInputNode | SubgraphOutputNode | undefined
}
