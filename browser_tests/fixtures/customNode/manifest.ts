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
  // by the run tier; empty or absent file = tier skips. Run the backend with
  // --cache-none, or repeat runs classify PARTIAL when cached nodes skip executing.
  workflow: string
  // Runtime class_type / object_info keys, NOT Python class names (e.g. rgthree
  // registers "Power Primitive (rgthree)", not RgthreePowerPrimitive).
  expectedNodes: string[]
  // Frontend extension names the pack's JS registers at boot (via
  // app.registerExtension), calibrated from the pinned source. Asserted
  // against window.app.extensions in the load tier: backend nodes can
  // register while the pack's frontend JS silently fails to load (wrong
  // web dir, a loadExtensions regression), and every JS-dependent
  // assertion in this suite would then quietly test vanilla nodes.
  // Empty array = the pinned pack ships no boot-registered extension.
  expectedExtensions: string[]
  // Exact number of nodes the pack registers at its pin, calibrated from the
  // gating CI's object_info. The all-nodes tiers derive their corpus from the
  // live backend, so without this a pack that silently registers fewer nodes
  // (a broken sub-import, a core change breaking registration) shrinks
  // coverage while CI stays green. Any delta - either direction - fails until
  // the count is deliberately recalibrated alongside a pin/core change.
  expectedNodeCount: number
  requiresGpu: boolean
  requiresModels: string[]
  timeoutMs: number
  // Optional; absent means true. Set false ONLY with evidence that the pack's
  // nodes fail to mount under Vue Nodes 2.0 (probe it - a README grumble is
  // not evidence). When false, renderer-specific Vue assertions are not
  // applied to this pack: its tests still run and pass their LiteGraph-canvas
  // assertions, so the zero-skip gate is preserved.
  vueNodesCompatible?: boolean
  // Node key -> evidenced reason it cannot mount under Vue Nodes 2.0; only
  // the Vue mount assertion is withheld. Stale keys fail the suite.
  vueIncompatibleNodes?: Record<string, string>
  // Nodes that cannot execute on pure defaults. Asserted both ways: an
  // unlisted failure is a regression, a listed clean run is a stale entry.
  cannotRunAlone?: string[]
}

// Exported for the pure spec's validation cases; production callers go
// through loadManifest.
export function assertEntry(
  entry: CustomNodeManifestEntry,
  index: number
): void {
  const missing: string[] = []
  // CI installs the pack into custom_nodes/<pack>, and node attribution keys
  // on that directory name via python_module - so pack must be a safe,
  // plain path segment, not just non-empty.
  if (
    typeof entry.pack !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(entry.pack)
  )
    missing.push('pack (must be a plain path segment)')
  // CI clones from repo, so an empty value must fail here, not mid-clone.
  if (typeof entry.repo !== 'string' || entry.repo.length === 0)
    missing.push('repo')
  // The gate tests exactly what was verified, so pin is a required full
  // commit SHA. CUSTOM_NODES_ALLOW_UNPINNED=1 is the one escape hatch,
  // reserved for the planned pack-HEAD canary - never for the PR gate.
  if (
    !/^[0-9a-f]{40}$/.test(entry.pin ?? '') &&
    !(
      process.env.CUSTOM_NODES_ALLOW_UNPINNED === '1' &&
      (entry.pin ?? '') === ''
    )
  )
    missing.push('pin (full 40-char commit SHA required)')
  // workflow may be an empty string until the pack gains a run-tier fixture.
  if (typeof entry.workflow !== 'string') missing.push('workflow')
  // A run-tier row with no workflow would otherwise skip locally, leaving
  // only CI's skip gate to notice the lost coverage. Fail at load instead.
  else if (
    entry.workflow === '' &&
    Array.isArray(entry.tiers) &&
    entry.tiers.includes('run')
  )
    missing.push('workflow (required when tiers includes "run")')
  if (!Array.isArray(entry.expectedNodes) || entry.expectedNodes.length === 0)
    missing.push('expectedNodes')
  // Explicitly required (an empty array is a deliberate "no frontend JS"
  // declaration) so a new pack row cannot silently opt out of the
  // extension-loaded assert by omission.
  if (
    !Array.isArray(entry.expectedExtensions) ||
    entry.expectedExtensions.some(
      (name) => typeof name !== 'string' || name.length === 0
    ) ||
    new Set(entry.expectedExtensions).size !== entry.expectedExtensions.length
  )
    missing.push('expectedExtensions (unique non-empty extension names)')
  if (
    !Number.isInteger(entry.expectedNodeCount) ||
    entry.expectedNodeCount <= 0
  )
    missing.push('expectedNodeCount (positive integer, calibrated at the pin)')
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
  if (
    entry.vueIncompatibleNodes !== undefined &&
    (typeof entry.vueIncompatibleNodes !== 'object' ||
      entry.vueIncompatibleNodes === null ||
      Array.isArray(entry.vueIncompatibleNodes) ||
      Object.values(entry.vueIncompatibleNodes).some(
        (reason) => typeof reason !== 'string' || reason.length === 0
      ))
  )
    missing.push('vueIncompatibleNodes (node key -> non-empty reason string)')
  if (
    entry.cannotRunAlone !== undefined &&
    (!Array.isArray(entry.cannotRunAlone) ||
      entry.cannotRunAlone.some(
        (key) => typeof key !== 'string' || key.length === 0
      ) ||
      new Set(entry.cannotRunAlone).size !== entry.cannotRunAlone.length)
  )
    missing.push('cannotRunAlone (unique non-empty node keys)')
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
