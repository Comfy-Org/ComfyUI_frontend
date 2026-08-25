import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync
} from 'node:fs'
import { fileURLToPath } from 'node:url'

// S13 differential interaction profiles: the def-driven tiers are
// structurally blind to what pack JS does IN RESPONSE to an interaction,
// and the curated tiers (S12 autogrow, S15 outputs) cover hand-picked
// nodes only. This tier locks the OBSERVED interaction behavior of every
// registered node - instantiate, connect-first, connect-last, disconnect -
// as shape DELTAS, without needing to understand any pack: whatever a
// node's JS does today is the baseline, and a frontend change that alters
// it reds against the committed delta. Deltas (not absolute shapes) keep
// baselines invariant to def changes a pin bump legitimately makes.

const PROFILE_DIR = fileURLToPath(
  new URL('./interactionProfiles/', import.meta.url)
)

// One facet entry per slot/widget: `kind:name:type`, model order ignored
// (entries are sorted) so reordering alone is not drift.
export interface LogicalShape {
  inputs: string[]
  outputs: string[]
  widgets: string[]
}

// The symmetric difference of two shapes: entries the interaction added
// (`+kind:name:type`) or removed (`-kind:name:type`), sorted. Empty means
// the interaction changed nothing - itself a locked observation.
export type ShapeDelta = string[]

// A probe that could not run carries its mechanism instead of a delta:
// NO_PRODUCER = no synthesizable model-free source matches the input type;
// NO_INPUTS = the node declares no connectable inputs (instantiate-only).
type ProbeResult = ShapeDelta | 'NO_PRODUCER' | 'NO_INPUTS'

export interface NodeInteractionProfile {
  connectFirst: ProbeResult
  // SAME_AS_FIRST when the node has exactly one connectable input.
  connectLast: ProbeResult | 'SAME_AS_FIRST'
  // Delta from disconnecting what connectLast (or connectFirst) attached,
  // measured against the connected shape - autogrow shrink lives here.
  disconnect: ProbeResult
}

export interface PackInteractionProfileFile {
  recordedAt: { core: string; pin: string }
  schema: 1
  nodes: Record<string, NodeInteractionProfile>
}

// Nodes whose interaction deltas are not reproducible run-to-run, keyed by
// the MECHANISM (the console ledger discipline): registration-guarded in
// the spec, announced in run output, omitted from baselines.
// Empty until a record/compare cycle observes real instability - entries
// are earned by evidence, never pre-emptively.
export const INTERACTION_UNSTABLE_NODES: Record<
  string,
  Record<string, string>
> = {}

export function diffShapes(
  before: LogicalShape,
  after: LogicalShape
): ShapeDelta {
  const delta: string[] = []
  for (const facet of ['inputs', 'outputs', 'widgets'] as const) {
    const beforeSet = new Set(before[facet])
    const afterSet = new Set(after[facet])
    for (const entry of afterSet)
      if (!beforeSet.has(entry)) delta.push(`+${entry}`)
    for (const entry of beforeSet)
      if (!afterSet.has(entry)) delta.push(`-${entry}`)
  }
  return delta.sort()
}

function profilePath(pack: string): string {
  return `${PROFILE_DIR}${pack}.json`
}

/**
 * A recorded baseline exists for this pack AND was recorded at this ref.
 *
 * S13 diffs a pack's live interaction shape against a committed recording, so
 * it can only cover packs that have one. Recording is a real artifact - the six
 * committed here run 1.7KB to 27KB each - and the cloud pack set deliberately
 * has none, so those packs sit outside S13 rather than being skipped inside it.
 *
 * The ref check is what stops a core recording being reused for the same pack
 * at a different cloud pin, where the baseline describes different code and
 * every legitimate version difference would read as drift.
 *
 * Directory listing rather than existsSync: the filenames are mixed-case and
 * the cloud rows are lowercase registry dirnames, so a case-insensitive
 * filesystem (macOS) matched five packs that Linux CI would match two of.
 */
export function hasCommittedProfile(pack: string, ref: string): boolean {
  const match = readdirSync(PROFILE_DIR).find(
    (name) => name.toLowerCase() === `${pack.toLowerCase()}.json`
  )
  if (!match) return false
  const parsed: unknown = JSON.parse(
    readFileSync(`${PROFILE_DIR}${match}`, 'utf-8')
  )
  assertProfileFile(parsed, `${PROFILE_DIR}${match}`)
  return parsed.recordedAt.pin === ref
}

const PROBES = ['connectFirst', 'connectLast', 'disconnect'] as const

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isProbeResult(value: unknown): value is ProbeResult {
  if (value === 'NO_PRODUCER' || value === 'NO_INPUTS') return true
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === 'string')
  )
}

// The offending field path, or null when the file is a valid profile set.
// A malformed baseline must name itself here: left unchecked it surfaces as
// an unrelated TypeError deep inside comparePackProfiles.
function invalidProfileField(parsed: unknown): string | null {
  if (!isPlainObject(parsed)) return 'root (expected a JSON object)'
  if (parsed.schema !== 1) return 'schema (expected 1)'
  if (!isPlainObject(parsed.recordedAt))
    return 'recordedAt (expected { core, pin })'
  if (!isNonEmptyString(parsed.recordedAt.core))
    return 'recordedAt.core (expected a non-empty string)'
  if (!isNonEmptyString(parsed.recordedAt.pin))
    return 'recordedAt.pin (expected a non-empty string)'
  if (!isPlainObject(parsed.nodes))
    return 'nodes (expected an object keyed by node type)'
  for (const [node, profile] of Object.entries(parsed.nodes)) {
    if (!isPlainObject(profile))
      return `nodes.${node} (expected a profile object)`
    for (const probe of PROBES) {
      const value = profile[probe]
      if (isProbeResult(value)) continue
      if (probe === 'connectLast' && value === 'SAME_AS_FIRST') continue
      const markers =
        probe === 'connectLast'
          ? "'NO_PRODUCER', 'NO_INPUTS', or 'SAME_AS_FIRST'"
          : "'NO_PRODUCER' or 'NO_INPUTS'"
      return `nodes.${node}.${probe} (expected a string[] delta, ${markers})`
    }
  }
  return null
}

function assertProfileFile(
  parsed: unknown,
  path: string
): asserts parsed is PackInteractionProfileFile {
  const field = invalidProfileField(parsed)
  if (field !== null)
    throw new Error(
      `${path} is not a valid interaction profile file - ${field} - re-record it (docs/custom-node-regression-suite.md Step 5d)`
    )
}

// null = no baseline recorded yet; compare mode must red on that (an
// uncovered pack is the failure mode this suite bans), record mode expects it.
export function loadPackProfiles(
  pack: string
): PackInteractionProfileFile | null {
  const path = profilePath(pack)
  if (!existsSync(path)) return null
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf-8'))
  assertProfileFile(parsed, path)
  return parsed
}

export function recordPackProfiles(
  pack: string,
  nodes: Record<string, NodeInteractionProfile>,
  recordedAt: { core: string; pin: string }
): void {
  mkdirSync(PROFILE_DIR, { recursive: true })
  const file: PackInteractionProfileFile = { recordedAt, schema: 1, nodes }
  writeFileSync(profilePath(pack), JSON.stringify(file, null, 2) + '\n')
}

function probesEqual(
  a: NodeInteractionProfile,
  b: NodeInteractionProfile
): string[] {
  const problems: string[] = []
  for (const probe of PROBES) {
    const expected = a[probe]
    const actual = b[probe]
    const same =
      typeof expected === 'string' || typeof actual === 'string'
        ? expected === actual
        : expected.length === actual.length &&
          expected.every((entry, i) => entry === actual[i])
    if (!same)
      problems.push(
        `${probe}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
      )
  }
  return problems
}

// Fail-closed compare, one problem string per drifted node: missing
// baseline file, node missing from baseline (new node = re-record), node
// gone from the live corpus (stale baseline), or any probe delta drifting.
export function comparePackProfiles(input: {
  pack: string
  observed: Record<string, NodeInteractionProfile>
  committed: PackInteractionProfileFile | null
}): string[] {
  const { pack, observed, committed } = input
  if (committed === null)
    return [
      `S13: no committed interaction profiles for '${pack}' - record them ` +
        `(CN_INTERACTION=record run, commit the fixture; docs/custom-node-regression-suite.md Step 5d)`
    ]
  const provenance = `(baseline recorded at core ${committed.recordedAt.core}, pin ${committed.recordedAt.pin})`
  const unstable = INTERACTION_UNSTABLE_NODES[pack] ?? {}
  const problems: string[] = []
  for (const [node, expected] of Object.entries(committed.nodes)) {
    if (node in unstable) continue
    const actual = observed[node]
    if (actual === undefined) {
      problems.push(
        `${pack}/${node}: baseline entry but the node was not probed - stale baseline, re-record ${provenance}`
      )
      continue
    }
    for (const problem of probesEqual(expected, actual))
      problems.push(
        `${pack}/${node}: interaction delta drifted - ${problem}. A frontend ` +
          `change altered what this node's JS does on interaction ${provenance}`
      )
  }
  for (const node of Object.keys(observed))
    if (!(node in committed.nodes) && !(node in unstable))
      problems.push(
        `${pack}/${node}: probed but no baseline entry - new node, re-record ${provenance}`
      )
  return problems
}
