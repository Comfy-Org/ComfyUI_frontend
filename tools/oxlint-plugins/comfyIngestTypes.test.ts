import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Run Oxlint's Node entrypoint directly; the .bin shim is a .cmd file on Windows
// and cannot be spawned as a bare executable.
const oxlintEntry = path.resolve('node_modules/oxlint/bin/oxlint')
const repoConfig = path.resolve('.oxlintrc.json')

// Probes are written into the trees `pnpm lint` actually lints and are checked
// through the repo's own .oxlintrc.json, so a scoping or severity regression
// fails here rather than passing against a bespoke config nothing else uses.
// Each run owns a unique subdirectory, lints only that directory instead of
// the whole src/browser_tests trees, and removes it on afterAll, process exit,
// and SIGINT/SIGTERM; leftovers from a hard-killed run are swept by the next
// run. (The roots must NOT be gitignored: oxlint honors .gitignore even for
// explicitly passed targets and with --no-ignore, so ignoring them would make
// every probe invisible to the very lint call under test.)
const PROBE_DIR = '__ingest_type_probes__'
const probeRoots = [
  path.resolve('src', PROBE_DIR),
  path.resolve('src/platform', PROBE_DIR),
  path.resolve('browser_tests/fixtures', PROBE_DIR)
]
const runId = `run-${process.pid}-${randomUUID().slice(0, 8)}`
const runDirs = probeRoots.map((root) => path.join(root, runId))

// A run writes its probes once and finishes linting them within seconds, so a
// probe directory older than five minutes can only be a leftover from an
// interrupted process. Fresh siblings are left alone so a run that started
// concurrently is never reaped mid-flight.
const STALE_PROBE_MS = 5 * 60 * 1000

function sweepStaleProbeRuns(
  roots: readonly string[],
  maxAgeMs = STALE_PROBE_MS
): void {
  const cutoff = Date.now() - maxAgeMs
  for (const root of roots) {
    let entries
    try {
      entries = readdirSync(root, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const child = path.join(root, entry.name)
      try {
        if (statSync(child).mtimeMs < cutoff) {
          rmSync(child, { recursive: true, force: true })
        }
      } catch {
        continue
      }
    }
  }
}

function removeProbeRun(): void {
  for (const dir of runDirs) rmSync(dir, { recursive: true, force: true })
}

// Registered as soon as this run might write probes: afterAll never runs after
// a crash or a worker timeout. Removing only this run's directories keeps the
// handler safe while another worker is still running, and rmSync(force) makes
// the afterAll + exit sequence idempotent.
let cleanupRegistered = false
function registerProbeCleanup(): void {
  if (cleanupRegistered) return
  cleanupRegistered = true
  process.on('exit', removeProbeRun)
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      removeProbeRun()
      // Restore default termination semantics: the main vitest process still
      // handles the signal; this worker must not outlive it.
      process.exit(signal === 'SIGINT' ? 130 : 143)
    })
  }
}

interface Finding {
  readonly file: string
  readonly severity: string
  readonly name: string
}

interface OxlintDiagnostic {
  readonly code?: string
  readonly severity?: string
  readonly filename?: string
  readonly message?: string
}

const RULE_CODE = 'comfy(no-duplicate-ingest-type)'

// `--format` is pinned: Oxlint picks its renderer from the environment, using a
// compact one-line format when it detects an agent CLI and a graphical one in CI.
function lint(targets: string[]): Finding[] {
  let stdout: string
  let failure: string | undefined
  try {
    stdout = execFileSync(
      process.execPath,
      [oxlintEntry, '--format=json', '--config', repoConfig, ...targets],
      { cwd: path.resolve('.'), encoding: 'utf8' }
    )
  } catch (err) {
    // Non-zero exit is expected: the rule reports at error severity.
    const failed = err as {
      stdout?: string
      stderr?: string
      status?: number
      message?: string
    }
    stdout = failed.stdout ?? ''
    failure = `exit ${failed.status ?? '?'}: ${failed.message ?? ''}\n${failed.stderr ?? ''}`
  }

  let diagnostics: readonly OxlintDiagnostic[] | undefined
  try {
    diagnostics = (JSON.parse(stdout) as { diagnostics?: OxlintDiagnostic[] })
      .diagnostics
  } catch {
    diagnostics = undefined
  }
  // An unreadable report must fail loudly. Yielding zero findings instead would
  // turn every "reports ..." case below into a silent pass of the negatives.
  if (diagnostics === undefined) {
    throw new Error(
      `Could not read Oxlint's JSON report (${failure ?? 'exit 0'}). stdout: ${stdout.slice(0, 400)}`
    )
  }

  return diagnostics
    .filter((diagnostic) => diagnostic.code === RULE_CODE)
    .map((diagnostic) => ({
      file: diagnostic.filename ?? '',
      severity: diagnostic.severity ?? '',
      name: /^'([^']+)'/.exec(diagnostic.message ?? '')?.[1] ?? ''
    }))
}

const accepted = `import type {
  ListMembersResponse as GeneratedListMembersResponse,
  Member as GeneratedMember,
  PendingInvite as GeneratedPendingInvite,
  PreviewSubscribeRequest as GeneratedPreviewSubscribeRequest,
  SubscribeRequest as GeneratedSubscribeRequest
} from '@comfyorg/ingest-types'

type Member = GeneratedMember & { credits_used_this_month?: number }

type PendingInvite = Omit<GeneratedPendingInvite, 'token'>

type SubscribeRequest = Omit<GeneratedSubscribeRequest, 'plan_slug'> &
  Partial<Pick<GeneratedSubscribeRequest, 'plan_slug'>>

interface PreviewSubscribeRequest extends GeneratedPreviewSubscribeRequest {
  billing_cycle?: 'monthly' | 'yearly'
}

type ListMembersResponse = GeneratedListMembersResponse | null

export type {
  Member,
  PendingInvite,
  SubscribeRequest,
  PreviewSubscribeRequest,
  ListMembersResponse
}
`

const reportedSource = `import type {
  AcceptInviteResponse as GeneratedAcceptInviteResponse,
  BillingStatusResponse as GeneratedBillingStatusResponse,
  ListMembersResponse as GeneratedListMembersResponse,
  Member as GeneratedMember,
  PendingInvite as GeneratedPendingInvite,
  Plan as GeneratedPlan,
  SubscribeRequest as GeneratedSubscribeRequest
} from '@comfyorg/ingest-types'

type Plan = Omit<GeneratedPlan, 'tier'> & { tier: 'FREE' | 'PRO' }

interface SubscribeRequest extends Omit<GeneratedSubscribeRequest, 'plan_slug'> {
  plan_slug: number
}

interface ListMembersResponse {
  total: number
}

type Member = GeneratedPlan & { note?: string }

type HiddenKeys = 'email' | 'expires_at'

type PendingInvite = Omit<GeneratedPendingInvite, HiddenKeys> & {
  email?: string
  expires_at?: number
}

type BillingStatusResponse = Omit<GeneratedBillingStatusResponse, 'plan_slug'> & {
  'plan_slug': number
}

type AcceptInviteResponse =
  | (Omit<GeneratedAcceptInviteResponse, 'workspace_id'> & {
      workspace_id: number
    })
  | null

export type {
  Plan,
  SubscribeRequest,
  ListMembersResponse,
  Member,
  PendingInvite,
  BillingStatusResponse,
  AcceptInviteResponse,
  HiddenKeys,
  GeneratedListMembersResponse,
  GeneratedMember
}
`

const uninvolved = `// Every name here is a generated export, but nothing is imported from the
// ingest package, so none may be reported. This is what keeps a generated-types
// refresh from reddening files that never touch the cloud API.
type Plan = { steps: string[] }
interface Member {
  handle: string
}
type ErrorResponse = { code: number }
type ValidationResult = { ok: boolean }

export type { Plan, Member, ErrorResponse, ValidationResult }
`

const unimported = `import type { Member as GeneratedMember } from '@comfyorg/ingest-types'

// CreateInviteRequest is a generated export too, but this file never imports
// it. Import provenance is the trigger, so the collision alone is not evidence.
type CreateInviteRequest = GeneratedMember & { note?: string }

export type { CreateInviteRequest }
`

const vueProbe = `<script setup lang="ts">
import type { Plan as GeneratedPlan } from '@comfyorg/ingest-types'

type Plan = Omit<GeneratedPlan, 'slug'> & { slug: number }

defineExpose({ plan: null as Plan | null })
</script>

<template>
  <div />
</template>
`

const browserTestProbe = `import type { Plan as GeneratedPlan } from '@comfyorg/ingest-types'

type Plan = Omit<GeneratedPlan, 'slug'> & { slug: number }

export type { Plan }
`

describe('comfy/no-duplicate-ingest-type', () => {
  let findings: Finding[]

  beforeAll(() => {
    registerProbeCleanup()
    sweepStaleProbeRuns(probeRoots)
    for (const dir of runDirs) mkdirSync(dir, { recursive: true })
    writeFileSync(path.join(runDirs[0], 'accepted.ts'), accepted)
    writeFileSync(path.join(runDirs[0], 'reported.ts'), reportedSource)
    writeFileSync(path.join(runDirs[0], 'uninvolved.ts'), uninvolved)
    writeFileSync(path.join(runDirs[0], 'unimported.ts'), unimported)
    writeFileSync(path.join(runDirs[1], 'Probe.vue'), vueProbe)
    writeFileSync(path.join(runDirs[2], 'probe.ts'), browserTestProbe)

    findings = lint(runDirs)
  })

  afterAll(() => {
    removeProbeRun()
    // Drop the probe roots too when this was the last live run. A concurrent
    // sibling still owns its own subdirectory, in which case this fails and
    // the empty-enough root simply stays until the next sweep.
    for (const root of probeRoots) {
      try {
        rmSync(root, { force: true })
      } catch {
        continue
      }
    }
  })

  const reported = (file: string) =>
    findings.filter((f) => f.file.endsWith(file)).map((f) => f.name)

  it('reports at error severity, so pnpm lint gates CI on it', () => {
    expect(findings.length).toBeGreaterThan(0)
    expect([...new Set(findings.map((f) => f.severity))]).toEqual(['error'])
  })

  it.for([
    ['an additive intersection', 'Member'],
    ['a projection that re-adds nothing', 'PendingInvite'],
    ['presence relaxed via Partial<Pick<...>>', 'SubscribeRequest'],
    ['an interface extending the generated export', 'PreviewSubscribeRequest'],
    ['a union of the generated export with null', 'ListMembersResponse']
  ])('accepts %s', ([, name]) => {
    expect(reported('accepted.ts')).not.toContain(name)
  })

  it.for([
    ['an alias that omits a key then re-declares it', 'Plan'],
    ['an interface that omits a key then re-declares it', 'SubscribeRequest'],
    [
      'an interface that redeclares instead of extending',
      'ListMembersResponse'
    ],
    ['an alias deriving from a generated export of another name', 'Member'],
    ['omitted keys hidden behind a same-file alias', 'PendingInvite'],
    ['a re-declared key written as a string literal', 'BillingStatusResponse'],
    ['drift inside one arm of a union', 'AcceptInviteResponse']
  ])('reports %s', ([, name]) => {
    expect(reported('reported.ts')).toContain(name)
  })

  it('never reports a colliding name in a file importing nothing generated', () => {
    expect(reported('uninvolved.ts')).toEqual([])
  })

  it('never reports a colliding name the file did not import', () => {
    expect(reported('unimported.ts')).toEqual([])
  })

  it('covers .vue single-file components, not just .ts', () => {
    expect(reported('Probe.vue')).toContain('Plan')
  })

  // browser_tests carries its own overrides block with its own jsPlugins list.
  // Root jsPlugins merge into it rather than being replaced, and fixtures are a
  // likely home for hand-built payloads, so pin that the rule reaches them.
  it('covers browser_tests fixtures, which have their own overrides block', () => {
    // Oxlint reports POSIX-style, run-relative filenames; path.join would emit
    // '\' on Windows and the suffix would never match.
    expect(reported(`${PROBE_DIR}/${runId}/probe.ts`)).toContain('Plan')
  })
})

describe('sweepStaleProbeRuns', () => {
  const root = path.join(tmpdir(), `ingest-probe-sweep-${randomUUID()}`)

  beforeAll(() => {
    mkdirSync(root, { recursive: true })
  })

  afterAll(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('removes probe directories older than the staleness floor', () => {
    const stale = path.join(root, 'run-crashed')
    mkdirSync(stale)
    const old = new Date(Date.now() - STALE_PROBE_MS - 1000)
    utimesSync(stale, old, old)

    sweepStaleProbeRuns([root])

    expect(existsSync(stale)).toBe(false)
  })

  it('keeps probe directories a concurrently running worker may still own', () => {
    const fresh = path.join(root, 'run-live')
    mkdirSync(fresh)

    sweepStaleProbeRuns([root])

    expect(existsSync(fresh)).toBe(true)
  })

  it('tolerates a probe root that does not exist', () => {
    expect(() =>
      sweepStaleProbeRuns([path.join(root, 'missing')])
    ).not.toThrow()
  })
})
