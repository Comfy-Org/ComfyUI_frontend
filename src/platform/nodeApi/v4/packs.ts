import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type { PackToken } from './types'
import { checkedReadable } from '@/platform/nodeApi/shared/readableInput'

/** A V4 pack the backend verified, served at `/extensions/<segment>/`. */
export interface ServedPack {
  readonly segment: string
  readonly id: string
  readonly version: string | null
}

/** A token `registerPack` issued, and what the host knows of it. */
export interface IssuedPack {
  readonly token: PackToken
  /** The lower-cased folder segment, under which an older backend's workflows saved the pack's fields. */
  readonly folderKey: string
  /** True if the backend verified the pack; only a verified pack stamps its nodes. */
  readonly verified: boolean
}

/** The tokens `registerPack` issues, and the checks `define` and `extend` make of them. */
export interface Packs {
  /** The backend's verified packs, or `undefined` when it gave none (an older backend). */
  provide(served: readonly ServedPack[] | undefined): void
  registerPack(meta: unknown): PackToken
  /** What the host knows of `pack` if `registerPack` issued it; a `TypeError` naming `member` otherwise. */
  checked(member: string, pack: unknown): IssuedPack
}

/** The node properties that name a node's pack, which the host sets and packs may not change. */
export const PACK_PROPERTIES: ReadonlySet<string> = new Set([
  'cnr_id',
  'aux_id',
  'ver'
])

const META_NEEDED = "import.meta, or an object with the module's url"

export function createPacks(extensionsUrl: () => string): Packs {
  const issued = new WeakMap<object, IssuedPack>()
  let served: ReadonlyMap<string, PackToken> | undefined
  const unverified = new Map<string, PackToken>()

  function issue(
    id: string,
    version: string | undefined,
    folderKey: string,
    verified: boolean
  ): PackToken {
    const token: PackToken = Object.freeze({ id, version })
    issued.set(token, { token, folderKey, verified })
    return token
  }

  function provide(packs: readonly ServedPack[] | undefined): void {
    if (!packs) {
      served = undefined
      return
    }
    const byId = new Map<string, PackToken>()
    const bySegment = new Map<string, PackToken>()
    for (const { segment, id, version } of packs) {
      const token =
        byId.get(id) ??
        issue(id, version ?? undefined, segment.toLowerCase(), true)
      byId.set(id, token)
      bySegment.set(segment, token)
    }
    served = bySegment
  }

  function segmentOf(url: string): string {
    const base = new URL(extensionsUrl())
    let module: URL
    try {
      module = new URL(url)
    } catch {
      throw invalidArgument('registerPack', META_NEEDED, url)
    }
    const rest = module.pathname.startsWith(base.pathname)
      ? module.pathname.slice(base.pathname.length)
      : ''
    const end = rest.indexOf('/')
    if (module.origin !== base.origin || end <= 0) {
      throw invalidArgument(
        'registerPack',
        `a module under ${base.href}<segment>/`,
        url
      )
    }
    try {
      return decodeURIComponent(rest.slice(0, end))
    } catch {
      throw invalidArgument(
        'registerPack',
        'a module whose folder segment decodes',
        url
      )
    }
  }

  function registerPack(meta: unknown): PackToken {
    const url = checkedReadable('registerPack', META_NEEDED, meta, (given) =>
      typeof given === 'object' && given !== null
        ? Reflect.get(given, 'url')
        : undefined
    )
    if (typeof url !== 'string') {
      throw invalidArgument('registerPack', META_NEEDED, meta)
    }
    const segment = segmentOf(url)
    if (served) {
      const token = served.get(segment)
      if (!token) {
        throw invalidArgument(
          'registerPack',
          'a module of a pack the backend verified',
          segment
        )
      }
      return token
    }
    const folderKey = segment.toLowerCase()
    const token =
      unverified.get(folderKey) ?? issue(folderKey, undefined, folderKey, false)
    unverified.set(folderKey, token)
    return token
  }

  return {
    provide,
    registerPack,
    checked(member, pack) {
      const known =
        typeof pack === 'object' && pack !== null ? issued.get(pack) : undefined
      if (!known) {
        throw invalidArgument(
          member,
          'the pack token comfy.registerPack gave',
          pack
        )
      }
      return known
    }
  }
}
