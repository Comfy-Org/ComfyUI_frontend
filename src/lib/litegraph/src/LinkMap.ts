import type { GraphScope } from '@/types/graphScopeId'
import type { LinkId } from '@/types/linkId'

import type { LLink } from './LLink'

export class LinkMap extends Map<LinkId, LLink> {
  constructor(
    private readonly scope: () => GraphScope | undefined,
    private readonly getLink: (
      scope: GraphScope,
      id: LinkId
    ) => LLink | undefined,
    private readonly links: (scope: GraphScope) => Iterable<LLink>,
    private readonly add: (link: LLink) => void,
    private readonly remove: (id: LinkId) => boolean
  ) {
    super()
  }

  override get size(): number {
    return [...this.values()].length
  }

  override clear(): void {
    for (const id of [...this.keys()]) this.remove(id)
  }

  override delete(id: LinkId): boolean {
    return this.remove(id)
  }

  override entries(): MapIterator<[LinkId, LLink]> {
    return this.snapshot().entries()
  }

  override forEach(
    callbackfn: (value: LLink, key: LinkId, map: Map<LinkId, LLink>) => void,
    thisArg?: unknown
  ): void {
    for (const [id, link] of this) callbackfn.call(thisArg, link, id, this)
  }

  override get(id: LinkId): LLink | undefined {
    const scope = this.scope()
    return scope ? this.getLink(scope, id) : undefined
  }

  override has(id: LinkId): boolean {
    return this.get(id) !== undefined
  }

  override keys(): MapIterator<LinkId> {
    return this.snapshot().keys()
  }

  override set(id: LinkId, link: LLink): this {
    if (id !== link.id) return this
    this.add(link)
    return this
  }

  override values(): MapIterator<LLink> {
    return this.snapshot().values()
  }

  override [Symbol.iterator](): MapIterator<[LinkId, LLink]> {
    return this.entries()
  }

  private snapshot(): Map<LinkId, LLink> {
    const scope = this.scope()
    if (!scope) return new Map()
    return new Map(
      [...this.links(scope)].map((link) => [link.id, link] as const)
    )
  }
}
