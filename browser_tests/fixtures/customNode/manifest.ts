import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Resolved lazily: under vitest's happy-dom environment import.meta.url is
// not a file: URL, and eager resolution would crash consumers that only
// import the validators.
function dataPath(basename: string): string {
  return fileURLToPath(new URL(`../data/${basename}`, import.meta.url))
}

const VALID_TIERS = ['load', 'run', 'connectivity', 'io'] as const

type CustomNodeTier = (typeof VALID_TIERS)[number]

const VALID_ENVS = ['core', 'cloud'] as const

// Expectations every suite environment asserts the same way, regardless of
// which backend registered the pack.
interface SharedNodeExpectations {
  pack: string
  tiers: CustomNodeTier[]
  // Frontend-format workflow (path relative to browser_tests/) loaded and queued
  // by the run tier; empty or absent file = tier skips. Run the backend with
  // --cache-none, or repeat runs classify PARTIAL when cached nodes skip executing.
  workflow: string
  // Runtime class_type / object_info keys, NOT Python class names (e.g. rgthree
  // registers "Power Primitive (rgthree)", not RgthreePowerPrimitive).
  expectedNodes: string[]
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
}

// A row of customNodeManifest.core.json: the gate CI clones `repo` at `pin`
// into custom_nodes/<pack>, so calibration (counts, extensions) tracks our
// pin bumps.
export interface CoreManifestEntry extends SharedNodeExpectations {
  repo: string
  pin: string
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
  // Nodes that cannot execute on pure defaults. Asserted both ways: an
  // unlisted failure is a regression, a listed clean run is a stale entry.
  cannotRunAlone?: string[]
}

// A row of customNodeManifest.cloud.json, generated (never hand-edited) by
// scripts/gen-cloud-manifest.ts from Cloud's supported_nodes.yaml plus a
// Cloud /object_info snapshot - so calibration tracks Cloud deploys, not our
// pins. The backend is remote and Cloud-installed: `deployRef` records what
// Cloud pinned (git URL@sha or registry id@version), and `disabledNodes`
// carries every label-disabled node with its labels as the exclusion
// mechanism.
export interface CloudManifestEntry extends SharedNodeExpectations {
  deployRef: string
  disabledNodes: Record<string, string[]>
  expectedExtensions: string[]
  expectedNodeCount: number
  cannotRunAlone?: string[]
}

// Top-level shape of customNodeManifest.cloud.json. The yaml's `core` entry
// is not a pack row: its label-disabled core nodes land here to feed the
// core-node exclusion expectations.
export interface CloudManifest {
  coreDisabledNodes: Record<string, string[]>
  packs: CloudManifestEntry[]
}

function sharedIssues(entry: SharedNodeExpectations): string[] {
  const missing: string[] = []
  // CI installs the pack into custom_nodes/<pack>, and node attribution keys
  // on that directory name via python_module - so pack must be a safe,
  // plain path segment, not just non-empty.
  if (
    typeof entry.pack !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(entry.pack)
  )
    missing.push('pack (must be a plain path segment)')
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
  if (!Number.isFinite(entry.timeoutMs) || entry.timeoutMs <= 0)
    missing.push('timeoutMs')
  if (
    entry.vueNodesCompatible !== undefined &&
    typeof entry.vueNodesCompatible !== 'boolean'
  )
    missing.push('vueNodesCompatible')
  if (
    entry.vueIncompatibleNodes !== undefined &&
    invalidRecordOf(entry.vueIncompatibleNodes, isNonEmptyString)
  )
    missing.push('vueIncompatibleNodes (node key -> non-empty reason string)')
  return missing
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0
}

function isLabelList(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(isNonEmptyString) &&
    new Set(value).size === value.length
  )
}

// True when the map is NOT a plain object of valid values - shared by the
// vueIncompatibleNodes, disabledNodes, and coreDisabledNodes shapes.
function invalidRecordOf(
  map: unknown,
  isValidValue: (value: unknown) => boolean
): boolean {
  return (
    typeof map !== 'object' ||
    map === null ||
    Array.isArray(map) ||
    Object.values(map).some((value) => !isValidValue(value))
  )
}

function calibrationIssues(
  entry: Pick<
    CoreManifestEntry,
    'expectedExtensions' | 'expectedNodeCount' | 'cannotRunAlone'
  >
): string[] {
  const missing: string[] = []
  // Explicitly required (an empty array is a deliberate "no frontend JS"
  // declaration) so a new pack row cannot silently opt out of the
  // extension-loaded assert by omission.
  if (
    !Array.isArray(entry.expectedExtensions) ||
    !entry.expectedExtensions.every(isNonEmptyString) ||
    new Set(entry.expectedExtensions).size !== entry.expectedExtensions.length
  )
    missing.push('expectedExtensions (unique non-empty extension names)')
  if (
    !Number.isInteger(entry.expectedNodeCount) ||
    entry.expectedNodeCount <= 0
  )
    missing.push('expectedNodeCount (positive integer, calibrated at the pin)')
  if (
    entry.cannotRunAlone !== undefined &&
    (!Array.isArray(entry.cannotRunAlone) ||
      !entry.cannotRunAlone.every(isNonEmptyString) ||
      new Set(entry.cannotRunAlone).size !== entry.cannotRunAlone.length)
  )
    missing.push('cannotRunAlone (unique non-empty node keys)')
  return missing
}

function throwIfIncomplete(
  label: string,
  pack: unknown,
  index: number,
  missing: string[]
): void {
  if (missing.length > 0)
    throw new Error(
      `${label} entry ${index} (${typeof pack === 'string' ? pack : '?'}) missing: ${missing.join(', ')}`
    )
}

// Exported for the pure spec's validation cases; production callers go
// through loadManifest.
export function assertCoreEntry(entry: CoreManifestEntry, index: number): void {
  const missing = sharedIssues(entry)
  // CI clones from repo, so an empty value must fail here, not mid-clone.
  if (!isNonEmptyString(entry.repo)) missing.push('repo')
  // The gate tests exactly what was verified, so pin is a required full
  // commit SHA. CUSTOM_NODES_ALLOW_UNPINNED=1 is a loader escape hatch
  // currently exercised only by the pure spec - the nightly pack-drift
  // canary ignores pin fields in its own install step instead, and the
  // PR gate never unpins.
  if (
    !/^[0-9a-f]{40}$/.test(entry.pin ?? '') &&
    !(
      process.env.CUSTOM_NODES_ALLOW_UNPINNED === '1' &&
      (entry.pin ?? '') === ''
    )
  )
    missing.push('pin (full 40-char commit SHA required)')
  missing.push(...calibrationIssues(entry))
  if (!Array.isArray(entry.requiresModels)) missing.push('requiresModels')
  if (typeof entry.requiresGpu !== 'boolean') missing.push('requiresGpu')
  throwIfIncomplete('custom-node manifest', entry.pack, index, missing)
}

// Cloud pins both ways in supported_nodes.yaml: git `URL@sha` or registry
// `id@version`. Anything else is a generator bug, not a new pin style.
const DEPLOY_REF_URL = /^https?:\/\/\S+@[0-9a-f]{40}$/
const DEPLOY_REF_REGISTRY = /^[A-Za-z0-9][A-Za-z0-9._-]*@\S+$/

export function assertCloudEntry(
  entry: CloudManifestEntry,
  index: number
): void {
  const missing = sharedIssues(entry)
  if (
    typeof entry.deployRef !== 'string' ||
    !(
      DEPLOY_REF_URL.test(entry.deployRef) ||
      DEPLOY_REF_REGISTRY.test(entry.deployRef)
    )
  )
    missing.push('deployRef (git URL@sha or registry id@version)')
  // Explicitly required: an empty map is the deliberate "Cloud disables
  // nothing in this pack" declaration, same discipline as expectedExtensions.
  if (invalidRecordOf(entry.disabledNodes, isLabelList))
    missing.push('disabledNodes (node key -> non-empty unique label list)')
  missing.push(...calibrationIssues(entry))
  throwIfIncomplete('custom-node cloud manifest', entry.pack, index, missing)
}

// Renderer passes for the load tier: LiteGraph canvas always, Vue Nodes 2.0
// unless the pack declares itself incompatible. Conditional coverage, never a
// test.skip - the caller still runs and gates on the returned passes.
export function rendererPassesFor(
  entry: Pick<SharedNodeExpectations, 'vueNodesCompatible'>
): boolean[] {
  return entry.vueNodesCompatible === false ? [false] : [false, true]
}

function customNodesEnv(): (typeof VALID_ENVS)[number] {
  const raw = process.env.CUSTOM_NODES_ENV || 'core'
  const env = VALID_ENVS.find((candidate) => candidate === raw)
  // A typo (CUSTOM_NODES_ENV=clod) silently running the core suite would
  // fake a green cloud run - same failure class the tiers typo check exists
  // for, so unknown values fail here too.
  if (env === undefined)
    throw new Error(
      `CUSTOM_NODES_ENV='${raw}' is not a suite environment (allowed: ${VALID_ENVS.join(', ')}; unset defaults to core)`
    )
  return env
}

function loadCloudManifest(): CloudManifestEntry[] {
  const cloudPath = dataPath('customNodeManifest.cloud.json')
  // A missing file must never degrade to an empty manifest: zero entries
  // generate zero tests, and the run would pass green while testing nothing.
  if (!existsSync(cloudPath))
    throw new Error(
      `CUSTOM_NODES_ENV=cloud but ${cloudPath} does not exist. ` +
        `The cloud manifest is generated, never hand-authored: run ` +
        `'pnpm gen:cloud-manifest <object-info-snapshot.json>' (scripts/` +
        `gen-cloud-manifest.ts), which joins the vendored browser_tests/` +
        `fixtures/data/cloud/supported_nodes.yaml with a Cloud /object_info ` +
        `snapshot. That snapshot is the Phase-1 probe output; until the ` +
        `probe has run, the cloud suite cannot run.`
    )
  const manifest = JSON.parse(readFileSync(cloudPath, 'utf-8')) as CloudManifest
  if (
    typeof manifest !== 'object' ||
    manifest === null ||
    invalidRecordOf(manifest.coreDisabledNodes, isLabelList) ||
    !Array.isArray(manifest.packs) ||
    // Zero packs generate zero tests: a green run that tested nothing.
    manifest.packs.length === 0
  )
    throw new Error(
      `${cloudPath} is malformed (expected { coreDisabledNodes, packs } with at least one pack): regenerate it via 'pnpm gen:cloud-manifest'`
    )
  manifest.packs.forEach(assertCloudEntry)
  return manifest.packs
}

export function loadManifest(): (CoreManifestEntry | CloudManifestEntry)[] {
  if (customNodesEnv() === 'cloud') return loadCloudManifest()
  const entries = JSON.parse(
    readFileSync(dataPath('customNodeManifest.core.json'), 'utf-8')
  ) as CoreManifestEntry[]
  entries.forEach(assertCoreEntry)
  return entries
}
