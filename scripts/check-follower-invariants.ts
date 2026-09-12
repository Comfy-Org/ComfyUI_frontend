/**
 * Deterministic (non-LLM) guards for the mechanical CRDT follower invariants
 * described in `.agents/checks/follower-boundary.md`. That reviewer profile
 * currently delegates repeatable syntax/import checks to LLM inference
 * (lines 31-33, 62-72, 82-93); this script covers the syntactic subset with
 * plain source scanning so those cases no longer depend on a model call.
 * Semantic/data-flow cases (e.g. "is this really the shared doc") stay with
 * the LLM reviewer — see the profile for what remains judgment-based.
 *
 * ADR: docs/adr/CRDT-FOLLOWER-0025-in-app-agent-crdt-follower-and-distribution-resolved-boundaries.md
 * Linear: FE-1968 (github.com/Comfy-Org/ComfyUI_frontend/issues/16497)
 *
 * Each exported `check*` function takes a file path + source text and
 * returns a list of violations (empty = pass). `main()` walks the real
 * follower-core file set; `check-follower-invariants.test.ts` drives the
 * same functions against in-memory fixtures (one forbidden-mutation fixture
 * per rule, plus one allowed-projection fixture that must pass every rule).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface Violation {
  file: string
  line: number
  rule: string
  message: string
}

/**
 * Files that make up the follower "apply seam" per ADR-CRDT-FOLLOWER-0025:
 * the wire client, the follower doc/gate/bridge, the ECS adapter, and the
 * op mint/send path. Distribution and endpoint checks (rules 3-4) apply only
 * here. Debug/report/log files intentionally read `DISTRIBUTION` for display
 * strings and are out of scope for those two rules (see
 * `crdtDebugReport.ts`'s `- **Distribution:** ${DISTRIBUTION}` line).
 */
export const FOLLOWER_CORE_FILES = [
  'src/workbench/extensions/agent/crdt/docFrameClient.ts',
  'src/workbench/extensions/agent/crdt/useAgentCrdtFollower.ts',
  'src/workbench/extensions/agent/crdt/followerDoc.ts',
  'src/workbench/extensions/agent/crdt/followerGate.ts',
  'src/workbench/extensions/agent/crdt/ecsFollowerAdapter.ts',
  'src/workbench/extensions/agent/crdt/layoutFollowerBridge.ts',
  'src/workbench/extensions/agent/crdt/opSender.ts',
  'src/workbench/extensions/agent/crdt/opEnvelope.ts',
  'src/workbench/extensions/agent/crdt/mintPortWiring.ts',
  'src/workbench/extensions/agent/crdt/mintSession.ts',
  'src/workbench/extensions/agent/crdt/mintGate.ts'
] as const

/**
 * Files under `crdt/` that are exempt from the "second applier" import
 * ban (rule 2) and the distribution/endpoint rules (rules 3-4) because they
 * are debug/report/log utilities, not the apply seam, or are test-scenario
 * simulators that intentionally reimplement merge behaviour offline for
 * fixtures (never wired into the live follower path).
 */
const NON_SEAM_ALLOWLIST = new Set([
  'src/workbench/extensions/agent/crdt/crdtDebugReport.ts',
  'src/workbench/extensions/agent/crdt/crdtDebugGate.ts',
  'src/workbench/extensions/agent/crdt/crdtLog.ts',
  'src/workbench/extensions/agent/crdt/devPanelLog.ts',
  'src/workbench/extensions/agent/crdt/mergeScenarios.ts',
  'src/workbench/extensions/agent/crdt/mergeTrace.ts'
])

const isTestOrFixture = (file: string): boolean =>
  /\.(test|spec)\.ts$/.test(file) || file.includes('__fixtures__/')

function scan(
  source: string,
  pattern: RegExp,
  build: (line: string, lineNumber: number) => Violation | null
): Violation[] {
  const violations: Violation[] = []
  const lines = source.split('\n')
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (!pattern.test(line)) continue
    const violation = build(line, index + 1)
    if (violation) violations.push(violation)
  }
  return violations
}

/**
 * Rule 1 (profile lines 31-33): the client never sends raw Yjs binary
 * (`update_b64`) upstream — it only ever *decodes* an inbound `update_b64`
 * field. Flags any object literal or send-call that constructs an outbound
 * `update_b64` key, while allowing the existing inbound `data.update_b64`
 * read/decode shape.
 */
export function checkNoOutboundUpdateB64(
  file: string,
  source: string
): Violation[] {
  if (isTestOrFixture(file)) return []
  // Constructing a frame: `{ ... update_b64: <expr> ... }` as an object we
  // are building (not destructuring/reading). A read looks like
  // `data.update_b64` or `.update_b64 ===`/`typeof x.update_b64`; a
  // construction looks like `update_b64:` immediately followed by a value,
  // inside code that is not a type/interface member declaration (those use
  // `update_b64?: unknown` or `update_b64: string` as a *type*, which this
  // rule must not flag).
  const CONSTRUCTION_PATTERN =
    /(?<!\.)\bupdate_b64\s*:\s*(?!unknown|string|Uint8Array)/
  const READ_PATTERN = /\.\s*update_b64\b/
  const TYPE_MEMBER_PATTERN =
    /^\s*update_b64\??\s*:\s*(unknown|string|Uint8Array)/

  return scan(source, /update_b64/, (line, lineNumber) => {
    if (READ_PATTERN.test(line)) return null
    if (TYPE_MEMBER_PATTERN.test(line)) return null
    if (!CONSTRUCTION_PATTERN.test(line)) return null
    return {
      file,
      line: lineNumber,
      rule: 'no-outbound-update-b64',
      message:
        'constructs an outbound update_b64 field — the client emits stamped doc_ops only; ' +
        'raw Yjs binary flows host -> follower one-way (KEEP-ALIVE #6, ADR-CRDT-FOLLOWER-0025)'
    }
  })
}

/**
 * Rule 2 (profile lines 62-72, first bullet): `op_id` is minted exactly
 * once by `mintOpId()` before dispatch and never regenerated on retry.
 * Flags any second call site that assigns a freshly generated id onto an
 * `op_id` field outside `opEnvelope.ts`'s own mint function, and any
 * `op_id:` object field assigned directly from a uuid/random call.
 */
export function checkNoOpIdRegeneration(
  file: string,
  source: string
): Violation[] {
  if (isTestOrFixture(file)) return []
  if (file.endsWith('opEnvelope.ts')) return [] // the one legitimate mint site
  const REGEN_PATTERN =
    /op_id\s*:\s*(createUuidv4|uuidv4|uuid|crypto\.randomUUID|mintOpId)\s*\(/

  return scan(source, /op_id\s*:/, (line, lineNumber) => {
    if (!REGEN_PATTERN.test(line)) return null
    return {
      file,
      line: lineNumber,
      rule: 'no-op-id-regeneration',
      message:
        'assigns a freshly minted op_id outside opEnvelope.ts — op_id is minted exactly once ' +
        'by mintOpId() before dispatch; a retry resends the same minted ops (FORECLOSE #7, ADR-CRDT-FOLLOWER-0025)'
    }
  })
}

/**
 * Rule 3 (profile lines 68-70): there must be exactly one applier
 * (`@comfyorg/comfy-multi-player`, pinned by SHA in package.json). Flags any
 * import from a package-manager-relative or local reimplementation path
 * that looks like a second applier: a local module literally named
 * `applier`/`docHost`/`opApplier`, or importing merge/conflict-resolution
 * helpers from anywhere other than the pinned package.
 */
export function checkSingleApplier(file: string, source: string): Violation[] {
  if (isTestOrFixture(file)) return []
  if (NON_SEAM_ALLOWLIST.has(file)) return []
  const FORBIDDEN_LOCAL_APPLIER_IMPORT =
    /^\s*import\s+.*from\s+['"](?!@comfyorg\/comfy-multi-player)[^'"]*\/(applier|docHost|opApplier|docApplier)['"]/

  return scan(source, /^\s*import\s+/, (line, lineNumber) => {
    if (!FORBIDDEN_LOCAL_APPLIER_IMPORT.test(line)) return null
    return {
      file,
      line: lineNumber,
      rule: 'single-applier',
      message:
        'imports a locally implemented applier module — op-to-doc/conflict-resolution logic must ' +
        'come from the single shared @comfyorg/comfy-multi-player package (FORECLOSE #3, ADR-CRDT-FOLLOWER-0025)'
    }
  })
}

/**
 * Rule 4 (profile lines 71-72): the widget catalog/vocabulary must be cited
 * by pinned SHA, never a moving branch name. Flags a catalog/vocabulary
 * reference alongside a `refs/heads/`, `HEAD`, or bare branch-name pattern
 * such as `main`/`master`/`develop` immediately following `catalog` or
 * `vocabulary` in the same line — the mechanical subset of "branch-pinned
 * citation"; judging an unfamiliar ref as a SHA vs. a branch name stays with
 * the LLM reviewer.
 */
export function checkCatalogPinnedBySha(
  file: string,
  source: string
): Violation[] {
  if (isTestOrFixture(file)) return []
  if (NON_SEAM_ALLOWLIST.has(file)) return []
  const BRANCH_CITATION_PATTERN =
    /(catalog|vocabulary)[^\n]{0,40}(refs\/heads\/[\w-]+|@(main|master|develop|HEAD)\b)/i

  return scan(source, /(catalog|vocabulary)/i, (line, lineNumber) => {
    if (!BRANCH_CITATION_PATTERN.test(line)) return null
    return {
      file,
      line: lineNumber,
      rule: 'catalog-pinned-by-sha',
      message:
        'cites the widget catalog/vocabulary by moving branch instead of a pinned SHA ' +
        '(FORECLOSE #10, ADR-CRDT-FOLLOWER-0025)'
    }
  })
}

/**
 * Rule 5 (profile lines 82-84): distribution conditionals must not scatter
 * through follower core — they belong only in the agent connection/config
 * boundary. Flags any reference to `DISTRIBUTION`, `isCloud`, or `isDesktop`
 * inside a `FOLLOWER_CORE_FILES` entry.
 */
export function checkNoScatteredDistributionChecks(
  file: string,
  source: string
): Violation[] {
  if (isTestOrFixture(file)) return []
  if (!(FOLLOWER_CORE_FILES as readonly string[]).includes(file)) return []
  const DISTRIBUTION_PATTERN = /\b(DISTRIBUTION|isCloud|isDesktop)\b/

  return scan(source, DISTRIBUTION_PATTERN, (line, lineNumber) => ({
    file,
    line: lineNumber,
    rule: 'no-scattered-distribution-checks',
    message:
      'references DISTRIBUTION/isCloud/isDesktop inside the follower apply seam — distribution ' +
      'conditionals belong only in the agent connection/configuration boundary (Priority 4, ADR-CRDT-FOLLOWER-0025)'
  }))
}

/**
 * Rule 6 (profile lines 90-93): no hardcoded agent base URL. Flags a literal
 * `ws://`, `wss://`, `http://`, or `https://` endpoint string inside a
 * `FOLLOWER_CORE_FILES` entry, outside of comments/tests. The centralized
 * `AGENT_BASE_URL`-style resolver is the only place an endpoint literal may
 * live.
 */
export function checkNoHardcodedEndpoint(
  file: string,
  source: string
): Violation[] {
  if (isTestOrFixture(file)) return []
  if (!(FOLLOWER_CORE_FILES as readonly string[]).includes(file)) return []
  const ENDPOINT_LITERAL_PATTERN = /['"](wss?|https?):\/\/[^'"]+['"]/

  return scan(source, ENDPOINT_LITERAL_PATTERN, (line, lineNumber) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return null
    return {
      file,
      line: lineNumber,
      rule: 'no-hardcoded-endpoint',
      message:
        'hardcodes an agent endpoint literal in follower core — resolve the endpoint through the ' +
        'centralized distribution-resolved AGENT_BASE_URL-style seam (Priority 4, ADR-CRDT-FOLLOWER-0025)'
    }
  })
}

export const CHECKS = [
  checkNoOutboundUpdateB64,
  checkNoOpIdRegeneration,
  checkSingleApplier,
  checkCatalogPinnedBySha,
  checkNoScatteredDistributionChecks,
  checkNoHardcodedEndpoint
]

export function checkFile(file: string, source: string): Violation[] {
  return CHECKS.flatMap((check) => check(file, source))
}

function main(): void {
  const repositoryRoot = process.cwd()
  const violations: Violation[] = []
  const scannedFiles = new Set<string>([...FOLLOWER_CORE_FILES])

  for (const file of scannedFiles) {
    let source: string
    try {
      source = readFileSync(resolve(repositoryRoot, file), 'utf8')
    } catch {
      continue // file removed/renamed; nothing to scan
    }
    violations.push(...checkFile(file, source))
  }

  if (violations.length === 0) {
    process.stdout.write(
      `Follower invariant guard passed (${scannedFiles.size} files scanned)\n`
    )
    return
  }

  process.stderr.write(
    `Follower invariant guard found ${violations.length} violation(s):\n\n` +
      violations
        .map((v) => `${v.file}:${v.line} [${v.rule}] ${v.message}`)
        .join('\n') +
      '\n\nSee .agents/checks/follower-boundary.md and ' +
      'docs/adr/CRDT-FOLLOWER-0025-in-app-agent-crdt-follower-and-distribution-resolved-boundaries.md\n'
  )
  process.exitCode = 1
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  main()
}
