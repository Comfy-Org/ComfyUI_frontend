import type { GraphScope } from '@/types/graphScopeId'
import type { LinkId } from '@/types/linkId'

import type { LLink } from './LLink'

export class LinkMap extends Map<LinkId, LLink> {
  private cachedRevision = -1
  private cachedLinks = new Map<LinkId, LLink>()

  constructor(
    private readonly scope: () => GraphScope | undefined,
    private readonly links: (scope: GraphScope) => Iterable<LLink>,
    private readonly revision: () => number,
    private readonly add: (link: LLink) => void,
    private readonly remove: (id: LinkId) => boolean
  ) {
    super()
  }

  override get size(): number {
    return this.current().size
  }

  override clear(): void {
    for (const id of [...this.keys()]) this.remove(id)
  }

  override delete(id: LinkId): boolean {
    return this.remove(id)
  }

  override entries(): MapIterator<[LinkId, LLink]> {
    return this.current().entries()
  }

  override forEach(
    callbackfn: (value: LLink, key: LinkId, map: Map<LinkId, LLink>) => void,
    thisArg?: unknown
  ): void {
    for (const [id, link] of this) callbackfn.call(thisArg, link, id, this)
  }

  override get(id: LinkId): LLink | undefined {
    return this.current().get(id)
  }

  override has(id: LinkId): boolean {
    return this.get(id) !== undefined
  }

  override keys(): MapIterator<LinkId> {
    return this.current().keys()
  }

  override set(id: LinkId, link: LLink): this {
    if (id !== link.id) {
      console.error(
        `LiteGraph: refusing to register link ${link.id} under mismatched id ${id}`
      )
      return this
    }
    this.add(link)
    return this
  }

  override values(): MapIterator<LLink> {
    return this.current().values()
  }

  override [Symbol.iterator](): MapIterator<[LinkId, LLink]> {
    return this.entries()
  }

  private current(): Map<LinkId, LLink> {
    const revision = this.revision()
    if (revision === this.cachedRevision) return this.cachedLinks

    const scope = this.scope()
    this.cachedRevision = revision
    this.cachedLinks = scope
      ? new Map([...this.links(scope)].map((link) => [link.id, link] as const))
      : new Map()
    return this.cachedLinks
  }
}
