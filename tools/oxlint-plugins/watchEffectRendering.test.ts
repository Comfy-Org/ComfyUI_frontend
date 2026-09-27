import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const oxlintEntry = path.resolve('node_modules/oxlint/bin/oxlint')
const pluginPath = path.resolve('tools/oxlint-plugins/comfy.ts')

const invalidFixture = `import { watchEffect, watchEffect as effect } from 'vue'

watchEffect(() => {
  canvas.draw(false, true)
  canvas?.setDirty(true, true)
})

effect(() => canvas['draw']())
`

const acceptedFixture = `import { watch, watchEffect } from 'vue'

watch(source, () => canvas.draw(false, true))

watchEffect(() => {
  const deferred = () => canvas.draw(false, true)
  register(deferred)
})

function runLocalEffect(watchEffect: (callback: () => void) => void) {
  watchEffect(() => canvas.setDirty(true, true))
}
`

interface Diagnostic {
  readonly code?: string
  readonly filename?: string
  readonly message?: string
}

describe('no-render-in-watch-effect', () => {
  let workDir: string
  let diagnostics: readonly Diagnostic[]

  beforeAll(() => {
    workDir = mkdtempSync(path.join(tmpdir(), 'comfy-watch-effect-'))
    writeFileSync(path.join(workDir, 'invalid.ts'), invalidFixture)
    writeFileSync(path.join(workDir, 'accepted.ts'), acceptedFixture)
    writeFileSync(
      path.join(workDir, '.oxlintrc.json'),
      JSON.stringify({
        jsPlugins: [pluginPath],
        rules: { 'comfy/no-render-in-watch-effect': 'error' }
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

  it('reports direct canvas rendering in Vue watchEffect callbacks', () => {
    const findings = diagnostics.filter(
      (diagnostic) => diagnostic.code === 'comfy(no-render-in-watch-effect)'
    )
    expect(findings).toHaveLength(3)
    expect(findings.map(({ message }) => message)).toEqual([
      expect.stringContaining('.draw()'),
      expect.stringContaining('.setDirty()'),
      expect.stringContaining('.draw()')
    ])
  })

  it('does not report explicit watch, deferred callbacks, or shadowed names', () => {
    expect(
      diagnostics.some(
        ({ code, filename }) =>
          code === 'comfy(no-render-in-watch-effect)' &&
          filename?.endsWith('accepted.ts')
      )
    ).toBe(false)
  })
})
