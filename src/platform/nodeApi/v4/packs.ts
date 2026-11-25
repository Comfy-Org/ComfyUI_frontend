import { zNodePackMetadata } from '@comfyorg/graph-model/workflowSchema'

import { isNodeCanonicalField } from '@/lib/litegraph/src/extensionPersistence'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { checkedReadable } from '@/platform/nodeApi/shared/readableInput'
import type { ServedPack } from '@/platform/nodeApi/shared/versionHost'
import type { PackId } from './types'

export interface IssuedPack {
  readonly packId: PackId
  /** True if the backend verified the pack; a verified pack stamps its nodes. */
  readonly verified: boolean
  /** The `folder:` entry a verified pack reads and moves to its id: its own folder's, when the folder names its id in any case. */
  readonly adopts?: string
}

export interface Packs {
  /** The backend's verified packs, or `undefined` when it gave none (an older backend). A folder the list names ambiguously loads unverified. */
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

export function refusePackProperty(member: string, name: string): void {
  if (PACK_PROPERTIES.has(name)) {
    throw invalidArgument(
      member,
      `a property other than ${[...PACK_PROPERTIES].join(', ')}`,
      name
    )
  }
}

const META_NEEDED = "import.meta, or an object with the module's url"

function usable(packId: PackId): PackId {
  const { id } = packId
  if (
    !zNodePackMetadata.shape.cnr_id.safeParse(id).success ||
    isNodeCanonicalField(id) ||
    id === 'extensions'
  ) {
    throw invalidArgument(
      'registerPack',
      'a pack whose id is a registry id and names no field a node saves',
      id
    )
  }
  return packId
}

function folderKeyOf(segment: string): string {
  return `folder:${segment}`
}

export function createPacks(extensionsUrl: () => string): Packs {
  const issued = new WeakMap<object, IssuedPack>()
  let served: ReadonlyMap<string, PackId> | undefined
  let ambiguous: ReadonlySet<string> = new Set()
  const warned = new Set<string>()
  const verified = new Map<string, PackId>()
  const unverified = new Map<string, PackId>()

  function issue(
    known: Omit<IssuedPack, 'packId'>,
    id: string,
    version?: string
  ): PackId {
    const packId: PackId = Object.freeze({ id, version })
    issued.set(packId, { packId, ...known })
    return packId
  }

  function provide(packs: readonly ServedPack[] | undefined): void {
    if (!packs) {
      served = undefined
      ambiguous = new Set()
      return
    }
    ambiguous = ambiguousFolders(packs)
    const bySegment = new Map<string, PackId>()
    for (const { segment, id, version } of packs) {
      if (ambiguous.has(segment)) continue
      bySegment.set(segment, verifiedAt(segment, id, version ?? undefined))
    }
    served = bySegment
  }

  function ambiguousFolders(packs: readonly ServedPack[]): Set<string> {
    const segmentsOf = new Map<string, Set<string>>()
    const idsAt = new Map<string, string[]>()
    for (const { segment, id } of packs) {
      segmentsOf.set(id, (segmentsOf.get(id) ?? new Set()).add(segment))
      idsAt.set(segment, [...(idsAt.get(segment) ?? []), id])
    }
    const unclear = new Set<string>()
    for (const { segment, id } of packs) {
      const segments = [...(segmentsOf.get(id) ?? [])]
      const ids = idsAt.get(segment) ?? []
      if (segments.length === 1 && ids.length === 1) continue
      unclear.add(segment)
      warnAmbiguous(id, segments, ids)
    }
    return unclear
  }

  function warnAmbiguous(id: string, segments: string[], ids: string[]) {
    const message =
      segments.length > 1
        ? `[extensions] The backend lists the V4 pack ${id} under the folders ${segments.join(', ')}; they load unverified.`
        : `[extensions] The backend lists the V4 packs ${ids.join(', ')} under the one folder ${segments.join('')}; it loads unverified.`
    if (warned.has(message)) return
    warned.add(message)
    console.warn(message)
  }

  function verifiedAt(
    segment: string,
    id: string,
    version: string | undefined
  ): PackId {
    const known = verified.get(segment)
    if (known?.id === id && known.version === version) return known
    const packId = issue(
      {
        verified: true,
        adopts:
          segment.toLowerCase() === id.toLowerCase()
            ? folderKeyOf(segment)
            : undefined
      },
      id,
      version
    )
    verified.set(segment, packId)
    return packId
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
    if (served && !ambiguous.has(segment)) {
      const packId = served.get(segment)
      if (!packId) {
        throw invalidArgument(
          'registerPack',
          'a module of a pack the backend verified',
          segment
        )
      }
      return usable(packId)
    }
    const folderKey = folderKeyOf(segment)
    const packId =
      unverified.get(folderKey) ?? issue({ verified: false }, folderKey)
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
