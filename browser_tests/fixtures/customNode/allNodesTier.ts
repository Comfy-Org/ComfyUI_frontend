import type {
  CloudManifestEntry,
  CoreManifestEntry,
  CustomNodeTier
} from '@e2e/fixtures/customNode/manifest'
import {
  expectedNodeCountFor,
  loadManifest
} from '@e2e/fixtures/customNode/manifest'
import type { RawNodeDef } from '@e2e/fixtures/customNode/typePairing'
import { normalizeNodeDefs } from '@e2e/fixtures/customNode/typePairing'

export type AllNodesTier = 'S1' | 'S2' | 'S3' | 'S9'
export type AllNodesManifestEntry = CoreManifestEntry | CloudManifestEntry

export const ALL_NODES_MANIFEST_ENTRIES = loadManifest()
export const INSTALLED_MANIFEST_PACKS = ALL_NODES_MANIFEST_ENTRIES.map(
  (entry) => entry.pack
)

export const ALL_NODES_TIER_CASES: ReadonlyArray<{
  tier: AllNodesTier
  title: string
}> = [
  {
    tier: 'S1',
    title: 'every enrolled registered node mounts on the canvas renderer'
  },
  {
    tier: 'S2',
    title: 'every enrolled registered node mounts on the DOM renderer'
  },
  {
    tier: 'S3',
    title: 'enrolled registered-node save/reload outcomes match exact contracts'
  },
  { tier: 'S9', title: 'calibrated model-free node corpus executes' }
]

const TIER_REQUIRES: Record<AllNodesTier, CustomNodeTier> = {
  S1: 'load',
  S2: 'load',
  S3: 'load',
  S9: 'run'
}

const INFRASTRUCTURE_PACKS = new Set([
  'ComfyUI_devtools',
  'websocket_image_save'
])

export function packNodeKeysFromDefs(
  defs: Record<string, RawNodeDef>,
  pack: string
): string[] {
  return normalizeNodeDefs(defs)
    .filter((node) => node.pack === pack)
    .map((node) => node.type)
    .sort()
}

export function entriesForAllNodesTier(
  entries: readonly AllNodesManifestEntry[],
  tier: AllNodesTier
): AllNodesManifestEntry[] {
  return entries.filter((entry) => entry.tiers.includes(TIER_REQUIRES[tier]))
}

export function allNodesTierTimeout(
  entries: readonly AllNodesManifestEntry[],
  tier: AllNodesTier
): number {
  const nodeCount = entries.reduce(
    (sum, entry) => sum + expectedNodeCountFor(entry),
    0
  )
  if (tier === 'S1') return 30_000 + nodeCount * 120
  if (tier === 'S2') return 30_000 + nodeCount * 350
  if (tier === 'S3') return 30_000 + nodeCount * 500
  return (
    60_000 +
    entries.reduce(
      (sum, entry) => sum + (entry.expectedRunnableCount ?? 0) * 30_000,
      0
    )
  )
}

export function unmanifestedPackNames(
  defs: Record<string, RawNodeDef>,
  entries: readonly AllNodesManifestEntry[]
): string[] {
  const live = new Set(
    normalizeNodeDefs(defs)
      .map((node) => node.pack)
      .filter((pack) => pack !== 'core' && !INFRASTRUCTURE_PACKS.has(pack))
  )
  const covered = new Set(entries.map((entry) => entry.pack))
  return [...live].filter((pack) => !covered.has(pack)).sort()
}
