import type { LinkId, LLink } from './LLink'
import type { Reroute, RerouteId } from './Reroute'

interface LinkStoreTopology {
  links: ReadonlyMap<LinkId, LLink>
  floatingLinks: ReadonlyMap<LinkId, LLink>
  reroutes: ReadonlyMap<RerouteId, Reroute>
}

/**
 * Passive graph-scoped topology store.
 *
 * Slice 1 contract: this store owns no mutation logic and is rehydrated from
 * graph lifecycle boundaries (`clear` and `configure`).
 */
export class LinkStore {
  private _links: ReadonlyMap<LinkId, LLink> = new Map()
  private _floatingLinks: ReadonlyMap<LinkId, LLink> = new Map()
  private _reroutes: ReadonlyMap<RerouteId, Reroute> = new Map()

  get links(): ReadonlyMap<LinkId, LLink> {
    return this._links
  }

  get floatingLinks(): ReadonlyMap<LinkId, LLink> {
    return this._floatingLinks
  }

  get reroutes(): ReadonlyMap<RerouteId, Reroute> {
    return this._reroutes
  }

  getLink(id: LinkId | null | undefined): LLink | undefined {
    return id == null ? undefined : this._links.get(id)
  }

  getFloatingLink(id: LinkId | null | undefined): LLink | undefined {
    return id == null ? undefined : this._floatingLinks.get(id)
  }

  getReroute(id: RerouteId | null | undefined): Reroute | undefined {
    return id == null ? undefined : this._reroutes.get(id)
  }

  clear(): void {
    this._links = new Map()
    this._floatingLinks = new Map()
    this._reroutes = new Map()
  }

  rehydrate(topology: LinkStoreTopology): void {
    this._links = topology.links
    this._floatingLinks = topology.floatingLinks
    this._reroutes = topology.reroutes
  }
}
