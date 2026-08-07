import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { customNodesEnv } from '@e2e/fixtures/customNode/manifest'

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

function profileDir(): string {
  return customNodesEnv() === 'cloud' ? `${PROFILE_DIR}cloud/` : PROFILE_DIR
}

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
// the MECHANISM (the geometry/console ledger discipline): registration-
// guarded in the spec, announced in run output, omitted from baselines.
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
  return `${profileDir()}${pack}.json`
}

// null = no baseline recorded yet; compare mode must red on that (an
// uncovered pack is the failure mode this suite bans), record mode expects it.
export function loadPackProfiles(
  pack: string
): PackInteractionProfileFile | null {
  const path = profilePath(pack)
  if (!existsSync(path)) return null
  const parsed = JSON.parse(readFileSync(path, 'utf-8'))
  if (parsed.schema !== 1 || !parsed.recordedAt?.core)
    throw new Error(
      `${path} is not schema 1 with recordedAt provenance - re-record it (docs/custom-node-regression-suite.md Step 5d)`
    )
  return parsed
}

export function recordPackProfiles(
  pack: string,
  nodes: Record<string, NodeInteractionProfile>,
  recordedAt: { core: string; pin: string }
): void {
  mkdirSync(profileDir(), { recursive: true })
  const file: PackInteractionProfileFile = { recordedAt, schema: 1, nodes }
  writeFileSync(profilePath(pack), JSON.stringify(file, null, 2) + '\n')
}

function probesEqual(
  a: NodeInteractionProfile,
  b: NodeInteractionProfile
): string[] {
  const problems: string[] = []
  for (const probe of ['connectFirst', 'connectLast', 'disconnect'] as const) {
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
