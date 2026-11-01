import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import { parseDocument } from 'yaml'

const ROOT = join(import.meta.dirname, '../..')
const TSX = join(ROOT, 'node_modules/.bin/tsx')

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'pr-report-disclosure-'))
  return {
    root,
    [Symbol.dispose]() {
      rmSync(root, { recursive: true, force: true })
    }
  }
}

function runExplainCheck(
  workspace: string,
  inputs: { slug: string; status: string }
) {
  const actionFile = parseDocument(
    readFileSync(
      join(ROOT, '.github/actions/explain-check/action.yaml'),
      'utf8'
    )
  )
  const script = actionFile.getIn(['runs', 'steps', 0, 'run'])
  expect(typeof script).toBe('string')
  const details = join(workspace, 'findings.md')
  writeFileSync(
    details,
    '| Finding | Remedy |\n| --- | --- |\n| Clone | Extract |'
  )
  return spawnSync('bash', ['-c', String(script)], {
    encoding: 'utf8',
    env: {
      ...process.env,
      INPUT_SLUG: inputs.slug,
      INPUT_TITLE: 'Test check',
      INPUT_ICON: '',
      INPUT_STATUS: inputs.status,
      INPUT_HEADLINE: 'Check summary.',
      INPUT_DETAILS_FILE: details,
      INPUT_REPRODUCE: 'pnpm check',
      INPUT_DOCS: 'docs/check.md',
      GITHUB_WORKSPACE: workspace,
      GITHUB_OUTPUT: join(workspace, 'output'),
      GITHUB_STEP_SUMMARY: join(workspace, 'summary'),
      GITHUB_SERVER_URL: 'https://github.com',
      GITHUB_REPOSITORY: 'owner/repo',
      GITHUB_RUN_ID: '123'
    }
  })
}

describe('shared PR report disclosure', () => {
  it.for([
    ['pass', ''],
    ['fail', 'fix the reported issues before merging'],
    ['warn', 'fix the reported issues before merging'],
    ['withheld', 'confirm the check was intentionally skipped'],
    ['running', '']
  ])(
    'collapses check details for %s with a visible action when needed',
    ([status, action]) => {
      using dir = fixture()
      const result = runExplainCheck(dir.root, { slug: 'test', status })
      expect(result.status).toBe(0)
      const output = readFileSync(join(dir.root, 'summary'), 'utf8')
      const visible = output.split('<details>')[0]
      expect(visible).toContain('Check summary.')
      expect(visible).toContain(action)
      expect(visible).not.toContain('| Finding |')
      expect(output).toMatch(
        /<summary>Findings and check details<\/summary>\n\n\| Finding[\s\S]*\n\n<\/details>/
      )
      expect(output).not.toContain('<details open')
    }
  )

  it.for(['../escape', 'Upper', 'a/b', '', 'a;b', 'a\nb'])(
    'rejects slug %j before writing any report file',
    (slug) => {
      using dir = fixture()
      const workspace = join(dir.root, 'workspace')
      mkdirSync(workspace)
      const result = runExplainCheck(workspace, { slug, status: 'pass' })

      expect(result.status).not.toBe(0)
      expect(result.stdout).toContain('explain-check: slug')
      expect(readdirSync(workspace)).toEqual(['findings.md'])
      expect(readdirSync(dir.root)).toEqual(['workspace'])
    }
  )

  it('accepts a slug with hyphens and digits and writes its section file', () => {
    using dir = fixture()
    const result = runExplainCheck(dir.root, {
      slug: 'custom-nodes-2',
      status: 'pass'
    })

    expect(result.status).toBe(0)
    const sectionFile = join(dir.root, '.explain-check-custom-nodes-2.md')
    expect(readFileSync(join(dir.root, 'output'), 'utf8')).toBe(
      `file=${sectionFile}\n`
    )
    expect(readFileSync(sectionFile, 'utf8')).toMatch(
      /^## {2}Test check: ✅ Passed\n/
    )
  })

  it('keeps failed FPS targets visible while collapsing passing scenario timings', () => {
    using dir = fixture()
    mkdirSync(join(dir.root, 'test-results'))
    writeFileSync(
      join(dir.root, 'test-results/perf-metrics.json'),
      JSON.stringify({
        measurements: [
          {
            name: 'fast',
            frameDurationMs: 16,
            p95FrameDurationMs: 17,
            totalBlockingTimeMs: 7,
            heapUsedBytes: 2048
          },
          {
            name: 'slow',
            frameDurationMs: 25,
            p95FrameDurationMs: 40,
            totalBlockingTimeMs: 23,
            heapUsedBytes: 4096
          }
        ]
      })
    )
    const result = spawnSync(TSX, [join(ROOT, 'scripts/perf-report.ts')], {
      cwd: dir.root,
      encoding: 'utf8'
    })
    expect(result.status).toBe(0)
    const visible = result.stdout.split('<details>')[0]
    expect(visible).toContain('**1 scenario below the ≥52 P5 FPS target.**')
    expect(visible).toContain('profile the affected scenarios before merging')
    expect(visible).not.toContain('**fast**')
    expect(visible).not.toContain('23ms TBT')
    expect(result.stdout).toMatch(
      /<summary>Scenario timings<\/summary>[\s\S]*62.5 avg FPS[\s\S]*23ms TBT[\s\S]*<\/details>/
    )
  })
})
