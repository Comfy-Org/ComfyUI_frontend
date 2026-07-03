import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const MANIFEST_PATH = fileURLToPath(
  new URL('../data/customNodeManifest.json', import.meta.url)
)

const VALID_TIERS = ['load', 'run', 'connectivity', 'io'] as const

type CustomNodeTier = (typeof VALID_TIERS)[number]

export interface CustomNodeManifestEntry {
  pack: string
  repo: string
  pin: string
  tiers: CustomNodeTier[]
  // Frontend-format workflow (path relative to browser_tests/) loaded and queued
  // by the run/io tiers; empty or absent file = tier skips. Run the backend with
  // --cache-none, or repeat runs classify PARTIAL when cached nodes skip executing.
  workflow: string
  // Runtime class_type / object_info keys, NOT Python class names (e.g. rgthree
  // registers "Power Primitive (rgthree)", not RgthreePowerPrimitive).
  expectedNodes: string[]
  requiresGpu: boolean
  requiresModels: string[]
  timeoutMs: number
  // Optional; absent means true. Set false ONLY with evidence that the pack's
  // nodes fail to mount under Vue Nodes 2.0 (probe it - a README grumble is
  // not evidence). When false, renderer-specific Vue assertions are not
  // applied to this pack: its tests still run and pass their LiteGraph-canvas
  // assertions, so the zero-skip gate is preserved.
  vueNodesCompatible?: boolean
}

function assertEntry(entry: CustomNodeManifestEntry, index: number): void {
  const missing: string[] = []
  if (typeof entry.pack !== 'string' || entry.pack.length === 0)
    missing.push('pack')
  // CI clones from repo, so an empty value must fail here, not mid-clone.
  // pin stays optional ("" = default branch head).
  if (typeof entry.repo !== 'string' || entry.repo.length === 0)
    missing.push('repo')
  // workflow may be an empty string until the pack gains a run-tier fixture.
  if (typeof entry.workflow !== 'string') missing.push('workflow')
  if (!Array.isArray(entry.expectedNodes) || entry.expectedNodes.length === 0)
    missing.push('expectedNodes')
  if (!Array.isArray(entry.tiers) || entry.tiers.length === 0)
    missing.push('tiers')
  // A typo like "connectivty" would otherwise pass and silently drop that
  // tier's coverage - the exact drift this manifest exists to catch.
  else if (entry.tiers.some((tier) => !VALID_TIERS.includes(tier)))
    missing.push(`tiers (unknown value; allowed: ${VALID_TIERS.join(', ')})`)
  if (!Array.isArray(entry.requiresModels)) missing.push('requiresModels')
  if (typeof entry.requiresGpu !== 'boolean') missing.push('requiresGpu')
  if (!Number.isFinite(entry.timeoutMs) || entry.timeoutMs <= 0)
    missing.push('timeoutMs')
  if (
    entry.vueNodesCompatible !== undefined &&
    typeof entry.vueNodesCompatible !== 'boolean'
  )
    missing.push('vueNodesCompatible')
  if (missing.length > 0)
    throw new Error(
      `custom-node manifest entry ${index} (${entry.pack ?? '?'}) missing: ${missing.join(', ')}`
    )
}

// Renderer passes for the load tier: LiteGraph canvas always, Vue Nodes 2.0
// unless the pack declares itself incompatible. Conditional coverage, never a
// test.skip - the caller still runs and gates on the returned passes.
export function rendererPassesFor(
  entry: Pick<CustomNodeManifestEntry, 'vueNodesCompatible'>
): boolean[] {
  return entry.vueNodesCompatible === false ? [false] : [false, true]
}

export function loadManifest(): CustomNodeManifestEntry[] {
  const entries = JSON.parse(
    readFileSync(MANIFEST_PATH, 'utf-8')
  ) as CustomNodeManifestEntry[]
  entries.forEach(assertEntry)
  return entries
}
