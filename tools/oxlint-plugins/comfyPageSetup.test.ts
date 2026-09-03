import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const oxlintEntry = path.resolve('node_modules/oxlint/bin/oxlint')
const pluginPath = path.resolve('tools/oxlint-plugins/comfy.ts')

const invalidFixture = `test('re-runs setup mid-test', async ({ comfyPage }) => {
  await comfyPage.setup({ clearStorage: false })
})
`

const acceptedFixture = `test('configures startup via fixture options', async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.TutorialCompleted', false)
})

class FakePage {
  async setup() {
    // Unrelated object named differently; only the comfyPage identifier is checked.
  }
}
`

interface Diagnostic {
  readonly code?: string
  readonly filename?: string
  readonly message?: string
}

describe('no-comfy-page-setup-call', () => {
  let workDir: string
  let diagnostics: readonly Diagnostic[]

  beforeAll(() => {
    workDir = mkdtempSync(path.join(tmpdir(), 'comfy-page-setup-'))
    writeFileSync(path.join(workDir, 'invalid.ts'), invalidFixture)
    writeFileSync(path.join(workDir, 'accepted.ts'), acceptedFixture)
    writeFileSync(
      path.join(workDir, '.oxlintrc.json'),
      JSON.stringify({
        jsPlugins: [pluginPath],
        rules: { 'comfy/no-comfy-page-setup-call': 'error' }
      })
    )

    let output: string
    try {
      output = execFileSync(
        process.execPath,
        [
          oxlintEntry,
          '--format=json',
          '--config',
          path.join(workDir, '.oxlintrc.json'),
          'invalid.ts',
          'accepted.ts'
        ],
        { cwd: workDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
      )
    } catch (error) {
      output = (error as { stdout?: string }).stdout ?? ''
    }

    diagnostics = (JSON.parse(output) as { diagnostics: Diagnostic[] })
      .diagnostics
  })

  afterAll(() => rmSync(workDir, { recursive: true, force: true }))

  it('reports a redundant comfyPage.setup() call inside a test', () => {
    const findings = diagnostics.filter(
      (diagnostic) => diagnostic.code === 'comfy(no-comfy-page-setup-call)'
    )
    expect(findings).toHaveLength(1)
    expect(findings[0]?.filename).toContain('invalid.ts')
    expect(findings[0]?.message).toContain('comfyPageFixture')
  })

  it('allows startup configured through fixture options and unrelated setup() methods', () => {
    const acceptedFindings = diagnostics.filter(
      (diagnostic) =>
        diagnostic.code === 'comfy(no-comfy-page-setup-call)' &&
        diagnostic.filename?.includes('accepted.ts')
    )
    expect(acceptedFindings).toHaveLength(0)
  })
})
