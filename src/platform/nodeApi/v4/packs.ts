import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { checkedReadable } from '@/platform/nodeApi/shared/readableInput'
import type { ServedPack } from '@/platform/nodeApi/shared/versionHost'
import type { PackId } from './types'

/** A pack id `registerPack` issued, and what the host knows of it. */
export interface IssuedPack {
  readonly packId: PackId
  /** The lower-cased folder segment, under which an older backend's workflows saved the pack's fields. */
  readonly folderKey: string
  /** True if the backend verified the pack; only a verified pack stamps its nodes. */
  readonly verified: boolean
}

/** The pack ids `registerPack` issues, and the checks `define` and `extend` make of them. */
export interface Packs {
  /** The backend's verified packs, or `undefined` when it gave none (an older backend). */
  provide(served: readonly ServedPack[] | undefined): void
  registerPack(meta: unknown): PackId
  /** What the host knows of `packId` if `registerPack` issued it; a `TypeError` naming `member` otherwise. */
  checked(member: string, packId: unknown): IssuedPack
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
  let served: ReadonlyMap<string, PackId> | undefined
  const unverified = new Map<string, PackId>()

  function issue(
    id: string,
    version: string | undefined,
    folderKey: string,
    verified: boolean
  ): PackId {
    const packId: PackId = Object.freeze({ id, version })
    issued.set(packId, { packId, folderKey, verified })
    return packId
  }

  function provide(packs: readonly ServedPack[] | undefined): void {
    if (!packs) {
      served = undefined
      return
    }
    const byId = new Map<string, PackId>()
    const bySegment = new Map<string, PackId>()
    for (const { segment, id, version } of packs) {
      const packId =
        byId.get(id) ??
        issue(id, version ?? undefined, segment.toLowerCase(), true)
      byId.set(id, packId)
      bySegment.set(segment, packId)
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

  function registerPack(meta: unknown): PackId {
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
      const packId = served.get(segment)
      if (!packId) {
        throw invalidArgument(
          'registerPack',
          'a module of a pack the backend verified',
          segment
        )
      }
      return packId
    }
    const folderKey = segment.toLowerCase()
    const packId =
      unverified.get(folderKey) ?? issue(folderKey, undefined, folderKey, false)
    unverified.set(folderKey, packId)
    return packId
  }

  return {
    provide,
    registerPack,
    checked(member, packId) {
      const known =
        typeof packId === 'object' && packId !== null
          ? issued.get(packId)
          : undefined
      if (!known) {
        throw invalidArgument(
          member,
          'the PackId comfy.registerPack gave',
          packId
        )
      }
      return known
    }
  }
}
