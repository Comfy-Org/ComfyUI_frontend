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
const websiteProbeDir = path.resolve('apps/website/e2e', PROBE_DIR)
const probeDirs = [specProbeDir, fixtureProbeDir, websiteProbeDir]

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

const settingsHooks = `test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
})
customTest.afterEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
})
`

const acceptedSettings = `test.use({ initialSettings: { 'Comfy.UseNewMenu': 'Disabled' } })
test('changes settings at runtime', async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
})
const customTest = base.extend({
  helper: async ({ comfyPage }, use) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await use(comfyPage)
  }
})
test.beforeEach(async () => {
  await unrelated.setSetting('other', true)
  await other.settings.setSetting('other', true)
})
test.afterEach(async () => {
  await other.settings.setSetting('other', false)
})
`

function lint(targets: string[]): readonly Diagnostic[] {
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

  return diagnostics
}

describe('comfyPage rules', () => {
  let findings: Diagnostic[]
  let settingsFindings: Diagnostic[]

  beforeAll(() => {
    for (const dir of probeDirs) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(path.join(specProbeDir, 'reported.spec.ts'), reportedSpec)
    writeFileSync(path.join(specProbeDir, 'accepted.spec.ts'), acceptedSpec)
    writeFileSync(path.join(fixtureProbeDir, 'fixture.ts'), fixtureProbe)
    writeFileSync(
      path.join(specProbeDir, 'settings-hooks.spec.ts'),
      settingsHooks
    )
    writeFileSync(path.join(specProbeDir, 'settings-hooks.ts'), settingsHooks)
    writeFileSync(
      path.join(specProbeDir, 'settings-accepted.spec.ts'),
      acceptedSettings
    )
    writeFileSync(path.join(fixtureProbeDir, 'settings.spec.ts'), settingsHooks)
    writeFileSync(path.join(websiteProbeDir, 'settings.spec.ts'), settingsHooks)

    const diagnostics = lint(probeDirs)
    findings = diagnostics.filter((diagnostic) => diagnostic.code === RULE_CODE)
    settingsFindings = diagnostics.filter(
      (diagnostic) => diagnostic.code === 'comfy(prefer-initial-settings)'
    )
  })

  afterAll(() => {
    for (const dir of probeDirs) {
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

  it('reports startup and reset hooks as errors, including custom test aliases', () => {
    const reported = settingsFindings.filter((finding) =>
      finding.filename?.endsWith('settings-hooks.spec.ts')
    )
    expect(reported).toHaveLength(2)
    expect(reported).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          message: expect.stringContaining('initialSettings')
        }),
        expect.objectContaining({
          severity: 'error',
          message: expect.stringContaining('teardown')
        })
      ])
    )
  })

  it('allows runtime changes and unrelated setters, and excludes hooks outside browser specs', () => {
    expect(
      settingsFindings.filter(
        (finding) => !finding.filename?.endsWith('settings-hooks.spec.ts')
      )
    ).toEqual([])
  })
})
