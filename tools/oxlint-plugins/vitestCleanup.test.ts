import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const pluginPath = path.resolve('tools/oxlint-plugins/comfy.ts')
const oxlintEntry = path.resolve('node_modules/oxlint/bin/oxlint')

const invalidFixture = `import {
  afterEach,
  afterEach as cleanup,
  beforeEach,
  beforeEach as setup,
  describe,
  it,
  vi,
  vi as vitest
} from 'vitest'
import * as Vitest from 'vitest'

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetAllMocks()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.clearAllMocks()
  vi.resetAllMocks()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

setup(() => vitest.clearAllMocks())
cleanup(() => vitest.resetAllMocks())
Vitest.beforeEach(() => Vitest.vi.restoreAllMocks())
Vitest.afterEach(() => Vitest.vi.unstubAllGlobals())

describe('nested suite', () => {
  afterEach(() => vi.unstubAllEnvs())
})

beforeEach(() => {
  if (globalThis.location) vi.clearAllMocks()
})

afterEach(() => vi.resetAllMocks())

beforeEach(async () => {
  await Promise.resolve()
  vi.restoreAllMocks()
})

beforeEach(() => {
  vi['unstubAllGlobals']()
  vi?.unstubAllEnvs?.()
})

beforeEach(() => {
  const deferred = () => vi.clearAllMocks()
  function helper() {
    vi.resetAllMocks()
  }
  class Deferred {
    cleanup = vi.restoreAllMocks()
  }
  void deferred
  void helper
  void Deferred
})

beforeEach(() => {
  // oxlint-disable-next-line comfy/no-redundant-vitest-cleanup -- this fixture verifies intentional suppression
  vi.clearAllMocks()
})

vi.stubGlobal('fetch', () => undefined)
vi.spyOn(console, 'error')
vitest.stubGlobal('Worker', class {})
Vitest.vi.spyOn(console, 'warn')
if (globalThis.location) vi.stubGlobal('location', undefined)
class ModuleDeferred {
  spy = vi.spyOn(console, 'info')
  static activeSpy = vi.spyOn(console, 'debug')
}
void ModuleDeferred

vi.mock('./module')
vi.fn(() => true)

const cleanupMethod = 'clearAllMocks'
const hookMethod = 'beforeEach'
const viMember = 'vi'
beforeEach(() => {
  vi[cleanupMethod]()
})
Vitest[hookMethod](() => vi.clearAllMocks())
Vitest[viMember].clearAllMocks()

beforeEach(() => {
  const vi = { clearAllMocks() {} }
  vi.clearAllMocks()
})

function register(beforeEach: (callback: () => void) => void) {
  beforeEach(() => vi.restoreAllMocks())
}
void register

{
  const vi = { spyOn() {} }
  vi.spyOn()
}

beforeEach(() => {
  vi.stubGlobal('fetch', () => undefined)
  vi.spyOn(console, 'error')
})

it('allows cleanup and mock installation in tests', () => {
  vi.clearAllMocks()
  vi.resetAllMocks()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.stubGlobal('fetch', () => undefined)
  vi.spyOn(console, 'error')
  const mock = vi.fn()
  mock.mockClear()
  mock.mockReset().mockImplementation(() => true)
  mock.mockRestore()
})

lateSetup(() => lateVi.clearAllMocks())
lateVi.stubGlobal('late', true)
import { beforeEach as lateSetup, vi as lateVi } from 'vitest'
`

const unrelatedFixture = `const vi = {
  clearAllMocks() {},
  spyOn() {},
  stubGlobal() {}
}

function beforeEach(callback: () => void) {
  callback()
}

beforeEach(() => vi.clearAllMocks())
vi.spyOn()
vi.stubGlobal()
`

describe('Vitest cleanup rules', () => {
  let workDir: string
  let output: string

  beforeAll(() => {
    workDir = mkdtempSync(path.join(tmpdir(), 'comfy-vitest-cleanup-'))
    writeFileSync(path.join(workDir, 'invalid.test.ts'), invalidFixture)
    writeFileSync(path.join(workDir, 'unrelated.test.ts'), unrelatedFixture)
    writeFileSync(path.join(workDir, 'playwright.spec.ts'), invalidFixture)
    writeFileSync(
      path.join(workDir, '.oxlintrc.json'),
      JSON.stringify({
        jsPlugins: [pluginPath],
        overrides: [
          {
            files: ['**/*.test.ts'],
            rules: {
              'comfy/no-module-scope-vitest-mocks': 'warn',
              'comfy/no-redundant-vitest-cleanup': 'warn'
            }
          }
        ]
      })
    )

    output = execFileSync(
      process.execPath,
      [
        oxlintEntry,
        '--config',
        path.join(workDir, '.oxlintrc.json'),
        'invalid.test.ts',
        'unrelated.test.ts',
        'playwright.spec.ts'
      ],
      { cwd: workDir, encoding: 'utf8' }
    )
  })

  afterAll(() => {
    rmSync(workDir, { recursive: true, force: true })
  })

  it('reports every suite-wide cleanup API in beforeEach and afterEach', () => {
    for (const method of [
      'clearAllMocks',
      'resetAllMocks',
      'restoreAllMocks',
      'unstubAllEnvs',
      'unstubAllGlobals'
    ]) {
      const reports = output.match(
        new RegExp(`vi\\.${method}\\(\\) is redundant`, 'g')
      )
      expect(reports?.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('handles aliases, namespaces, concise callbacks, and nested control flow', () => {
    expect(output.match(/is redundant in beforeEach\/afterEach/g)).toHaveLength(
      21
    )
  })

  it('reports module-scope stubs and spies', () => {
    expect(output.match(/removes module-scope mocks/g)).toHaveLength(7)
  })

  it('ignores unrelated names, nested helpers, test bodies, and Playwright specs', () => {
    expect(output).not.toContain('unrelated.test.ts')
    expect(output).not.toContain('playwright.spec.ts')
  })
})
