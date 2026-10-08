import { spawnSync } from 'node:child_process'
import {
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { beforeEach, describe, expect, it, onTestFinished } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const packageName = '@comfyorg/comfy-multi-player'
const require = createRequire(import.meta.url)

it('resolves multiplayer source and shares one Yjs installation with the frontend', () => {
  const entry = require.resolve(packageName)
  expect(realpathSync(entry)).toBe(
    join(root, 'packages/comfy-multi-player/src/index.ts')
  )
  expect(createRequire(entry).resolve('yjs')).toBe(require.resolve('yjs'))
})

describe('published baseline override', () => {
  let file: string
  const manifest = {
    dependencies: { [packageName]: 'workspace:*', yjs: 'catalog:' }
  }

  beforeEach(() => {
    const dir = mkdtempSync(join(tmpdir(), 'crdt-baseline-'))
    onTestFinished(() => rmSync(dir, { recursive: true }))
    file = join(dir, 'package.json')
    writeFileSync(file, JSON.stringify(manifest))
  })

  function override(args: string[]) {
    return spawnSync(
      process.execPath,
      [
        join(root, '.github/scripts/crdt-skew-override.mjs'),
        '--file',
        file,
        ...args
      ],
      { encoding: 'utf8' }
    )
  }

  it('replaces only the workspace consumer dependency with an exact release', () => {
    expect(override(['--spec', '0.3.10']).status).toBe(0)
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({
      dependencies: { [packageName]: '0.3.10', yjs: 'catalog:' }
    })
  })

  it.for([[], ['0.3.10'], ['--spec', '^0.3.10'], ['--spec', '0.3.10-beta.1']])(
    'rejects invalid arguments without changing the manifest: %j',
    (args) => {
      expect(override(args).status).not.toBe(0)
      expect(readFileSync(file, 'utf8')).toBe(JSON.stringify(manifest))
    }
  )

  it('refuses to overwrite an unexpected consumer dependency', () => {
    const original = JSON.stringify({
      dependencies: { [packageName]: '0.3.6' }
    })
    writeFileSync(file, original)
    expect(override(['--spec', '0.3.10']).status).not.toBe(0)
    expect(readFileSync(file, 'utf8')).toBe(original)
  })
})

it.for([
  {
    report: '{}',
    outcome: 'success',
    verdict: 'inconclusive-incomplete-suite'
  },
  { report: 'invalid', outcome: 'success', verdict: 'inconclusive-no-report' },
  {
    report: '{"numTotalTests":3,"numPassedTests":3}',
    outcome: 'success',
    verdict: 'no-skew-signal'
  },
  {
    report: '{"numTotalTests":3,"numPassedTests":2}',
    outcome: 'success',
    verdict: 'inconclusive-incomplete-suite'
  },
  {
    report: '{"numTotalTests":3,"numPassedTests":3}',
    outcome: 'failure',
    verdict: 'inconclusive-runner-failed'
  },
  {
    report: '{"numFailedTests":1}',
    outcome: 'failure',
    verdict: 'skew-signal'
  },
  {
    report: '{"testResults":[{"status":"failed","name":"import.test.ts"}]}',
    outcome: 'failure',
    verdict: 'skew-signal'
  }
])(
  'reports $verdict for $outcome with $report',
  ({ report, outcome, verdict }) => {
    const dir = mkdtempSync(join(tmpdir(), 'crdt-report-'))
    onTestFinished(() => rmSync(dir, { recursive: true }))
    const file = join(dir, 'vitest.json')
    writeFileSync(file, report)
    const result = spawnSync(
      process.execPath,
      [join(root, '.github/scripts/crdt-skew-report.mjs'), '--report', file],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          GITHUB_OUTPUT: '',
          GITHUB_STEP_SUMMARY: '',
          CMP_PACKAGE: packageName,
          CMP_SHA: 'workspace-commit',
          CMP_SPEC: 'release',
          PINNED_VERSION: '0.3.10',
          TESTS_OUTCOME: outcome
        }
      }
    )
    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      schema: 'crdt-skew-alarm/2',
      premise: 'workspace-vs-release',
      package: packageName,
      release_version: '0.3.10',
      workspace_sha: 'workspace-commit',
      source: 'release',
      verdict
    })
  }
)
