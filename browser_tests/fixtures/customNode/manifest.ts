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
  // Per-node Vue Nodes 2.0 incompatibility ledger: node key -> reason with
  // evidence (author statement or reproduced mount failure; a run failure
  // alone is NOT evidence - it may be our own fixture error). Ledgered nodes
  // keep every canvas assertion; only their Vue mount assertion is withheld.
  // A key that stops existing on the backend fails the suite, so entries
  // cannot silently rot.
  vueIncompatibleNodes?: Record<string, string>
  // Auto-run baseline: nodes observed unable to execute standalone on a bare
  // backend (validation reject or execution error on pure defaults - empty
  // expressions, empty folders, no webcam). Asserted BOTH ways: a failing
  // node missing from this list is a regression, and a listed node that now
  // runs clean must be removed. Weak-signal territory by design - a wrong
  // entry here means a fixture gap, never a skipped test.
  cannotRunAlone?: string[]
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
