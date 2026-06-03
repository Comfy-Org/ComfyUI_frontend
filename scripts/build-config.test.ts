/**
 * Tests for build configuration changes introduced in this PR:
 *
 * - package.json: NODE_OPTIONS removed from individual build scripts
 * - pnpm-workspace.yaml: nodeOptions added at workspace level with
 *   --no-experimental-webstorage and --max-old-space-size=8192
 * - vite.config.mts: execArgv removed from vitest test config (no longer
 *   needed since the flag is applied at workspace level)
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '..')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readRootFile(filename: string): string {
  return fs.readFileSync(path.join(ROOT, filename), 'utf8')
}

function readPackageJson(): Record<string, unknown> & {
  scripts: Record<string, string>
} {
  return JSON.parse(readRootFile('package.json')) as Record<string, unknown> & {
    scripts: Record<string, string>
  }
}

// ---------------------------------------------------------------------------
// package.json – NODE_OPTIONS removed from build scripts
// ---------------------------------------------------------------------------

describe('package.json build scripts', () => {
  it('build:cloud does not set NODE_OPTIONS inline', () => {
    const { scripts } = readPackageJson()
    expect(scripts['build:cloud']).not.toContain('NODE_OPTIONS')
  })

  it('build does not set NODE_OPTIONS inline', () => {
    const { scripts } = readPackageJson()
    expect(scripts['build']).not.toContain('NODE_OPTIONS')
  })

  it('build:types does not set NODE_OPTIONS inline', () => {
    const { scripts } = readPackageJson()
    expect(scripts['build:types']).not.toContain('NODE_OPTIONS')
  })

  it('build:cloud still sets DISTRIBUTION=cloud via cross-env', () => {
    const { scripts } = readPackageJson()
    expect(scripts['build:cloud']).toContain('DISTRIBUTION=cloud')
    expect(scripts['build:cloud']).toContain('cross-env')
  })

  it('build:cloud still invokes vite build with the correct config', () => {
    const { scripts } = readPackageJson()
    expect(scripts['build:cloud']).toContain('vite build')
    expect(scripts['build:cloud']).toContain('vite.config.mts')
  })

  it('build still runs pnpm typecheck before vite build', () => {
    const { scripts } = readPackageJson()
    expect(scripts['build']).toMatch(/pnpm typecheck.+vite build/s)
  })

  it('build:types still runs vite build and prepare-types.js', () => {
    const { scripts } = readPackageJson()
    expect(scripts['build:types']).toContain('vite build')
    expect(scripts['build:types']).toContain('prepare-types.js')
  })

  it('build:cloud does not inline --max-old-space-size', () => {
    const { scripts } = readPackageJson()
    expect(scripts['build:cloud']).not.toContain('--max-old-space-size')
  })

  it('build does not inline --max-old-space-size', () => {
    const { scripts } = readPackageJson()
    expect(scripts['build']).not.toContain('--max-old-space-size')
  })

  it('build:types does not inline --max-old-space-size', () => {
    const { scripts } = readPackageJson()
    expect(scripts['build:types']).not.toContain('--max-old-space-size')
  })
})

// ---------------------------------------------------------------------------
// pnpm-workspace.yaml – workspace-level nodeOptions added
// ---------------------------------------------------------------------------

describe('pnpm-workspace.yaml nodeOptions', () => {
  let yamlContent: string

  // Read once for the whole describe block
  beforeAll(() => {
    yamlContent = readRootFile('pnpm-workspace.yaml')
  })

  it('contains a nodeOptions entry', () => {
    expect(yamlContent).toContain('nodeOptions:')
  })

  it('nodeOptions includes --no-experimental-webstorage flag', () => {
    expect(yamlContent).toContain('--no-experimental-webstorage')
  })

  it('nodeOptions includes --max-old-space-size=8192', () => {
    expect(yamlContent).toContain('--max-old-space-size=8192')
  })

  it('nodeOptions uses ${NODE_OPTIONS:- } shell parameter expansion', () => {
    // The pattern ${NODE_OPTIONS:- } means: use $NODE_OPTIONS when set,
    // otherwise fall back to a single space so extra flags can be safely appended.
    expect(yamlContent).toContain('${NODE_OPTIONS:-')
  })

  it('nodeOptions line contains both required flags on the same logical value', () => {
    // The value must contain both flags so they are applied together.
    const nodeOptionsLine = yamlContent
      .split('\n')
      .find((line) => line.trimStart().startsWith('nodeOptions:'))
    expect(nodeOptionsLine).toBeDefined()
    expect(nodeOptionsLine).toContain('--no-experimental-webstorage')
    expect(nodeOptionsLine).toContain('--max-old-space-size=8192')
  })

  it('nodeOptions value matches the expected workspace configuration', () => {
    const expected =
      "nodeOptions: '${NODE_OPTIONS:- } --no-experimental-webstorage --max-old-space-size=8192'"
    expect(yamlContent).toContain(expected)
  })

  it('still defines workspace packages at apps/** and packages/**', () => {
    expect(yamlContent).toContain('- apps/**')
    expect(yamlContent).toContain('- packages/**')
  })
})

// ---------------------------------------------------------------------------
// vite.config.mts – execArgv removed from vitest test configuration
// ---------------------------------------------------------------------------

describe('vite.config.mts vitest test configuration', () => {
  let configContent: string

  beforeAll(() => {
    configContent = readRootFile('vite.config.mts')
  })

  it('does not contain execArgv in the test config section', () => {
    expect(configContent).not.toContain('execArgv')
  })

  it('does not contain --no-experimental-webstorage inline within the config', () => {
    // The flag moved to pnpm-workspace.yaml; it should no longer appear in
    // the vite config.
    expect(configContent).not.toContain('--no-experimental-webstorage')
  })

  it('does not contain Node version check for webstorage workaround', () => {
    // The old workaround parsed process.versions.node and conditionally added
    // --no-experimental-webstorage.  Neither pattern should remain.
    expect(configContent).not.toContain('experimental-webstorage')
    expect(configContent).not.toContain("process.versions.node.split('.')")
  })

  it('test config still uses happy-dom environment', () => {
    expect(configContent).toContain("environment: 'happy-dom'")
  })

  it('test config still enables globals', () => {
    expect(configContent).toContain('globals: true')
  })

  it('test config still references vitest.setup.ts', () => {
    expect(configContent).toContain('vitest.setup.ts')
  })

  it('test config includes retry for CI', () => {
    // Retry logic must remain to avoid flaky tests in CI
    expect(configContent).toContain('process.env.CI ? 2 : 0')
  })
})
