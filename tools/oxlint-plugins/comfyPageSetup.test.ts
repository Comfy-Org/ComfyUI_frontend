import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Run Oxlint's Node entrypoint directly; the .bin shim is a .cmd file on Windows
// and cannot be spawned as a bare executable.
const oxlintEntry = path.resolve('node_modules/oxlint/bin/oxlint')
const repoConfig = path.resolve('.oxlintrc.json')

// Probes are written into the trees `pnpm lint` actually lints and are checked
// through the repo's own .oxlintrc.json. The rule is only correct together with
// its override scope: spec files must be reported, while the fixtures that own
// the one legitimate `comfyPage.setup()` call must stay silent.
const PROBE_DIR = '__comfy_page_setup_probes__'
const specProbeDir = path.resolve('browser_tests/tests', PROBE_DIR)
const fixtureProbeDir = path.resolve('browser_tests/fixtures', PROBE_DIR)

const RULE_CODE = 'comfy(no-comfy-page-setup-call)'

interface Diagnostic {
  readonly code?: string
  readonly severity?: string
  readonly filename?: string
  readonly message?: string
}

const reportedSpec = `test('re-runs setup mid-test', async ({ comfyPage }) => {
  await comfyPage.setup({ clearStorage: false })
})
`

const acceptedSpec = `test('configures startup via fixture options', async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.TutorialCompleted', false)
})

class FakePage {
  async setup() {
    // Unrelated object named differently; only the comfyPage identifier is checked.
  }
}
`

const fixtureProbe = `export async function prepare(comfyPage: { setup(): Promise<void> }) {
  await comfyPage.setup()
}
`

function lint(targets: string[]): Diagnostic[] {
  let stdout: string
  let failure: string | undefined
  try {
    stdout = execFileSync(
      process.execPath,
      [oxlintEntry, '--format=json', '--config', repoConfig, ...targets],
      {
        cwd: path.resolve('.'),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
      }
    )
  } catch (err) {
    // Non-zero exit is expected: the rule reports at error severity.
    const failed = err as { stdout?: string; stderr?: string; status?: number }
    stdout = failed.stdout ?? ''
    failure = `exit ${failed.status ?? '?'}\n${failed.stderr ?? ''}`
  }

  let diagnostics: readonly Diagnostic[] | undefined
  try {
    diagnostics = (JSON.parse(stdout) as { diagnostics?: Diagnostic[] })
      .diagnostics
  } catch {
    diagnostics = undefined
  }
  if (diagnostics === undefined) {
    throw new Error(
      `Could not read Oxlint's JSON report (${failure ?? 'exit 0'}). stdout: ${stdout.slice(0, 400)}`
    )
  }

  return diagnostics.filter((diagnostic) => diagnostic.code === RULE_CODE)
}

describe('no-comfy-page-setup-call', () => {
  let findings: Diagnostic[]

  beforeAll(() => {
    for (const dir of [specProbeDir, fixtureProbeDir]) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(path.join(specProbeDir, 'reported.spec.ts'), reportedSpec)
    writeFileSync(path.join(specProbeDir, 'accepted.spec.ts'), acceptedSpec)
    writeFileSync(path.join(fixtureProbeDir, 'fixture.ts'), fixtureProbe)

    findings = lint([specProbeDir, fixtureProbeDir])
  })

  afterAll(() => {
    for (const dir of [specProbeDir, fixtureProbeDir]) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('reports a redundant comfyPage.setup() call in a spec at error severity', () => {
    const reported = findings.filter((finding) =>
      finding.filename?.includes('reported.spec.ts')
    )
    expect(reported).toHaveLength(1)
    expect(reported[0]?.severity).toBe('error')
    expect(reported[0]?.message).toContain('comfyPageFixture')
  })

  it('allows startup configured through fixture options and unrelated setup() methods', () => {
    const accepted = findings.filter((finding) =>
      finding.filename?.includes('accepted.spec.ts')
    )
    expect(accepted).toHaveLength(0)
  })

  it('does not apply to fixtures, which own the single legitimate setup() call', () => {
    const fixtureFindings = findings.filter((finding) =>
      finding.filename?.includes('fixture.ts')
    )
    expect(fixtureFindings).toHaveLength(0)
    expect(findings).toHaveLength(1)
  })
})
