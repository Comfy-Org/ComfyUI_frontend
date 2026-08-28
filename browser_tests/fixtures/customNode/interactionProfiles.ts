import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

// S13 differential interaction profiles: the def-driven tiers are
// structurally blind to what pack JS does IN RESPONSE to an interaction,
// and the curated tiers (S12 autogrow, S15 outputs) cover hand-picked
// nodes only. This tier locks the OBSERVED interaction behavior of every
// registered node - instantiate, connect-first, connect-last, disconnect -
// as shape DELTAS, without needing to understand any pack: whatever a
// node's JS does today is the baseline, and a frontend change that alters
// it reds against the committed delta. Deltas (not absolute shapes) keep
// baselines invariant to def changes a pin bump legitimately makes.

const PROFILE_DIR = join(import.meta.dirname, 'interactionProfiles')

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
  schema: 3
  corpus: { count: number; nodeTypesSha256: string }
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
  return join(PROFILE_DIR, `${pack}.json`)
}

const PROBES = ['connectFirst', 'connectLast', 'disconnect'] as const

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function interactionCorpusIdentity(nodeTypes: string[]): {
  count: number
  nodeTypesSha256: string
} {
  const sorted = [...nodeTypes].sort()
  return {
    count: sorted.length,
    nodeTypesSha256: createHash('sha256')
      .update(sorted.join('\n'))
      .digest('hex')
  }
}

// The offending field path, or null when the file is a valid profile set.
// A malformed baseline must name itself here: left unchecked it surfaces as
// an unrelated TypeError deep inside comparePackProfiles.
function invalidProfileField(parsed: unknown): string | null {
  if (!isPlainObject(parsed)) return 'root (expected a JSON object)'
  if (parsed.schema !== 3) return 'schema (expected 3)'
  if (!isPlainObject(parsed.recordedAt))
    return 'recordedAt (expected { core, pin })'
  if (!isNonEmptyString(parsed.recordedAt.core))
    return 'recordedAt.core (expected a non-empty string)'
  if (!isNonEmptyString(parsed.recordedAt.pin))
    return 'recordedAt.pin (expected a non-empty string)'
  if (!isPlainObject(parsed.corpus))
    return 'corpus (expected { count, nodeTypesSha256 })'
  if (
    !Number.isInteger(parsed.corpus.count) ||
    (parsed.corpus.count as number) < 0
  )
    return 'corpus.count (expected a non-negative integer)'
  if (
    typeof parsed.corpus.nodeTypesSha256 !== 'string' ||
    !/^[0-9a-f]{64}$/.test(parsed.corpus.nodeTypesSha256)
  )
    return 'corpus.nodeTypesSha256 (expected a sha256 digest)'
  if (!isPlainObject(parsed.nodes))
    return 'nodes (expected an object keyed by node type)'
  for (const [node, profile] of Object.entries(parsed.nodes)) {
    if (!isPlainObject(profile))
      return `nodes.${node} (expected a profile object)`
    const unknown = Object.keys(profile).filter(
      (key) => !PROBES.includes(key as (typeof PROBES)[number])
    )
    if (unknown.length > 0)
      return `nodes.${node} (unknown probe ${unknown.join(', ')})`
    for (const probe of PROBES) {
      const result = profile[probe]
      if (result === undefined) return `nodes.${node}.${probe} (missing)`
      const validMarker =
        result === 'NO_PRODUCER' ||
        result === 'NO_INPUTS' ||
        (probe === 'connectLast' && result === 'SAME_AS_FIRST')
      if (
        !validMarker &&
        (!Array.isArray(result) || !result.every(isNonEmptyString))
      )
        return `nodes.${node}.${probe} (expected a delta or probe marker)`
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
  const file: PackInteractionProfileFile = {
    recordedAt,
    schema: 3,
    corpus: interactionCorpusIdentity(Object.keys(nodes)),
    nodes
  }
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
  expectedPin: string
  observed: Record<string, NodeInteractionProfile>
  committed: PackInteractionProfileFile | null
}): string[] {
  const { pack, expectedPin, observed, committed } = input
  if (committed === null)
    return [
      `S13: no committed interaction profiles for '${pack}' - record them ` +
        `(CN_INTERACTION=record run, commit the fixture; docs/custom-node-regression-suite.md Step 5d)`
    ]
  if (committed.recordedAt.pin !== expectedPin)
    return [
      `S13: ${pack} profile pin is '${committed.recordedAt.pin}', expected '${expectedPin}' - re-record it`
    ]
  const provenance = `(baseline recorded at core ${committed.recordedAt.core}, pin ${committed.recordedAt.pin})`
  const unstable = INTERACTION_UNSTABLE_NODES[pack] ?? {}
  const problems: string[] = []
  const observedCorpus = interactionCorpusIdentity(Object.keys(observed))
  if (
    observedCorpus.count !== committed.corpus.count ||
    observedCorpus.nodeTypesSha256 !== committed.corpus.nodeTypesSha256
  )
    problems.push(
      `${pack}: interaction corpus changed from ${committed.corpus.count}/${committed.corpus.nodeTypesSha256} to ${observedCorpus.count}/${observedCorpus.nodeTypesSha256} - re-record ${provenance}`
    )
  const nodes = new Set([
    ...Object.keys(committed.nodes),
    ...Object.keys(observed)
  ])
  for (const node of nodes) {
    if (node in unstable) continue
    const expected = committed.nodes[node]
    const actual = observed[node]
    if (expected === undefined || actual === undefined) {
      problems.push(
        `${pack}/${node}: interaction profile is ${expected === undefined ? 'missing from the baseline' : 'missing from the live probe'} ${provenance}`
      )
      continue
    }
    for (const problem of probesEqual(expected, actual))
      problems.push(
        `${pack}/${node}: interaction delta drifted - ${problem}. A frontend ` +
          `change altered what this node's JS does on interaction ${provenance}`
      )
  }
  return problems
}
