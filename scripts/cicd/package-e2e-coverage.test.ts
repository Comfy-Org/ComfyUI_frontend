import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const SCRIPT = join(import.meta.dirname, 'package-e2e-coverage.sh')

interface WorkflowStep {
  id?: string
  if?: string
  uses?: string
  with?: { name?: string; path?: string }
}

interface WorkflowJob {
  needs?: string[]
  strategy?: { matrix?: { shardIndex?: number[]; shardTotal?: number[] } }
  steps?: WorkflowStep[]
  with?: { shard_total?: number; shards_succeeded?: string }
}

interface E2eWorkflow {
  jobs?: Record<string, WorkflowJob>
}

const readWorkflow = (path: string) =>
  parse(readFileSync(path, 'utf8')) as E2eWorkflow

function coverage(sourcePrefix: string) {
  return Array.from(
    { length: 100 },
    (_, index) =>
      `SF:${sourcePrefix}/file ${index}.ts\nDA:1,1\nLF:1\nLH:1\nend_of_record\n`
  ).join('')
}

function coverageFixture() {
  const root = mkdtempSync(join(tmpdir(), 'e2e-coverage-'))
  const shards = join(root, 'shards')
  const output = join(root, 'coverage')
  const html = join(root, 'html')
  const bin = join(root, 'bin')
  const githubOutput = join(root, 'github-output')
  const summary = join(root, 'summary')
  mkdirSync(shards)
  mkdirSync(bin)

  writeFileSync(
    join(bin, 'lcov'),
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == "--remove" ]]; then
  exit 0
fi
inputs=()
output=''
while [[ $# -gt 0 ]]; do
  case "$1" in
    -a)
      inputs+=("$2")
      shift 2
      ;;
    -o)
      output="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done
: > "$output"
for input in "\${inputs[@]}"; do
  cat "$input" >> "$output"
done
`,
    { mode: 0o755 }
  )
  writeFileSync(
    join(bin, 'genhtml'),
    `#!/usr/bin/env bash
set -euo pipefail
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "-o" ]]; then
    mkdir -p "$2"
    touch "$2/index.html"
    exit 0
  fi
  shift
done
exit 1
`,
    { mode: 0o755 }
  )

  return {
    root,
    shards,
    output,
    html,
    githubOutput,
    summary,
    writeShard(name: string, contents: string) {
      const shard = join(shards, name)
      mkdirSync(shard, { recursive: true })
      writeFileSync(join(shard, 'coverage.lcov'), contents)
    },
    run(
      expectedShards: string | number = 1,
      shardsSucceeded: string | boolean = true
    ) {
      const result = spawnSync(
        'bash',
        [
          SCRIPT,
          shards,
          output,
          html,
          String(expectedShards),
          String(shardsSucceeded),
          'abc1234def5678'
        ],
        {
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${bin}:${process.env.PATH ?? ''}`,
            GITHUB_OUTPUT: githubOutput,
            GITHUB_STEP_SUMMARY: summary
          }
        }
      )
      return {
        status: result.status,
        output: `${result.stdout}${result.stderr}`
      }
    },
    [Symbol.dispose]() {
      rmSync(root, { recursive: true, force: true })
    }
  }
}

function readMetadata(outputDir: string): unknown {
  return JSON.parse(
    readFileSync(join(outputDir, 'coverage-metadata.json'), 'utf8')
  )
}

describe('package-e2e-coverage.sh', () => {
  it('marks a merge complete when every shard reported coverage', () => {
    using fixture = coverageFixture()
    fixture.writeShard('e2e-coverage-shard-1', coverage('src'))
    fixture.writeShard('e2e-coverage-shard-2', coverage('src'))

    const result = fixture.run(2)

    expect(result.status).toBe(0)
    expect(readFileSync(fixture.githubOutput, 'utf8')).toBe(
      'has-coverage=true\nshards-found=2\nshards-expected=2\ncomplete=true\n'
    )
    expect(readMetadata(fixture.output)).toEqual({
      shardsFound: 2,
      shardsExpected: 2,
      complete: true,
      reason: '',
      sourceSha: 'abc1234def5678'
    })
    expect(result.output).not.toContain('::warning::')
  })

  // Preserves #15342: a flaky shard must not discard every other shard's real
  // coverage. It stays published for Codecov and the PR comment, but flagged.
  it('publishes a partial run with a whitespace path but flags it incomplete', () => {
    using fixture = coverageFixture()
    fixture.writeShard('failed shard 1', coverage('src'))

    const result = fixture.run(16)

    expect(result.status).toBe(0)
    expect(readFileSync(fixture.githubOutput, 'utf8')).toBe(
      'has-coverage=true\nshards-found=1\nshards-expected=16\ncomplete=false\n'
    )
    expect(readMetadata(fixture.output)).toEqual({
      shardsFound: 1,
      shardsExpected: 16,
      complete: false,
      reason: 'only 1 of 16 shards reported coverage',
      sourceSha: 'abc1234def5678'
    })
    expect(result.output).toContain(
      '::warning::E2E coverage merge is not verified as whole — only 1 of 16 shards'
    )
    expect(
      readFileSync(join(fixture.output, 'coverage.lcov'), 'utf8')
    ).toContain('SF:src/file 0.ts')

    const summary = readFileSync(fixture.summary, 'utf8')
    expect(summary).toContain('failed shard 1')
    expect(summary).toContain('**1 / 16** shards merged')
    expect(summary).toContain('only 1 of 16 shards reported coverage')
    expect(existsSync(join(fixture.html, 'index.html'))).toBe(true)
  })

  // A shard that dies partway still uploads a tracefile via globalTeardown,
  // so a full count alone cannot prove the merge is whole.
  it('flags a full shard count incomplete when the matrix did not pass', () => {
    using fixture = coverageFixture()
    fixture.writeShard('e2e-coverage-shard-1', coverage('src'))
    fixture.writeShard('e2e-coverage-shard-2', coverage('src'))

    const result = fixture.run(2, false)

    expect(result.status).toBe(0)
    expect(readFileSync(fixture.githubOutput, 'utf8')).toContain(
      'complete=false'
    )
    expect(readMetadata(fixture.output)).toEqual({
      shardsFound: 2,
      shardsExpected: 2,
      complete: false,
      reason:
        'all 2 shards reported coverage but the matrix did not pass, so a shard may have stopped early',
      sourceSha: 'abc1234def5678'
    })
    expect(result.output).toContain(
      '::warning::E2E coverage merge is not verified as whole'
    )
  })

  it('rejects a non-boolean shards-succeeded flag', () => {
    using fixture = coverageFixture()
    fixture.writeShard('e2e-coverage-shard-1', coverage('src'))

    const result = fixture.run(1, 'yes')

    expect(result.status).toBe(1)
    expect(result.output).toContain(
      "shards-succeeded must be 'true' or 'false'"
    )
  })

  it('skips successfully when no shard artifacts exist', () => {
    using fixture = coverageFixture()

    const result = fixture.run(16)

    expect(result.status).toBe(0)
    expect(readFileSync(fixture.githubOutput, 'utf8')).toBe(
      'has-coverage=false\n'
    )
    expect(existsSync(join(fixture.output, 'coverage.lcov'))).toBe(false)
  })

  it('fails when coverage is not mapped to repository sources', () => {
    using fixture = coverageFixture()
    fixture.writeShard('served-bundle', coverage('assets'))

    const result = fixture.run(1)

    expect(result.status).toBe(1)
    expect(result.output).toContain('Only 0 files under src/ or packages/')
    expect(existsSync(join(fixture.html, 'index.html'))).toBe(false)
  })

  it('rejects a non-numeric expected shard count', () => {
    using fixture = coverageFixture()
    fixture.writeShard('e2e-coverage-shard-1', coverage('src'))

    const result = fixture.run('sixteen')

    expect(result.status).toBe(1)
    expect(result.output).toContain(
      'expected-shards must be a positive integer'
    )
  })
})

// The packager cannot see the matrix that produced its shards, so the expected
// count is passed in by hand. Nothing else stops the two from drifting.
describe('shard total contract', () => {
  it('passes the chromium matrix size to the coverage packager', () => {
    const workflow = readWorkflow('.github/workflows/ci-tests-e2e.yaml')

    const matrix =
      workflow.jobs?.['playwright-tests-chromium-sharded']?.strategy?.matrix
    const shardTotal = workflow.jobs?.['upload-e2e-coverage']?.with?.shard_total

    expect(shardTotal).toBeTypeOf('number')
    expect(matrix?.shardTotal).toEqual([shardTotal])
    expect(matrix?.shardIndex).toEqual(
      Array.from({ length: Number(shardTotal) }, (_, index) => index + 1)
    )
  })
})

// The sidecar only reaches the notifier because the whole coverage directory
// is uploaded. Narrowing either upload to coverage.lcov would strand it, and
// consumers treat absent metadata as an incomplete merge.
describe('e2e-coverage artifact contract', () => {
  it.for([
    '.github/workflows/ci-tests-e2e-coverage-package.yaml',
    '.github/workflows/ci-tests-e2e-coverage.yaml'
  ])('uploads the coverage directory in %s', (file) => {
    const uploads = Object.values(readWorkflow(file).jobs ?? {})
      .flatMap((job) => job.steps ?? [])
      .filter(
        (step) =>
          step.uses?.startsWith('actions/upload-artifact@') === true &&
          step.with?.name === 'e2e-coverage'
      )

    expect(uploads).not.toHaveLength(0)
    for (const upload of uploads) {
      const paths = (upload.with?.path ?? '')
        .split('\n')
        .map((entry) => entry.trim())
        .filter(Boolean)

      expect(paths).not.toHaveLength(0)
      for (const path of paths) {
        expect(path.replace(/\/$/, '')).toBe('coverage/playwright')
      }
    }
  })
})

// actionlint is not wired into CI, so these assertions are the only automated
// guard on the two predicates that decide whether a number is trustworthy.
describe('completeness gate wiring', () => {
  const SHARDED = 'playwright-tests-chromium-sharded'

  it('derives shards_succeeded from the sharded matrix verdict', () => {
    const workflow = readWorkflow('.github/workflows/ci-tests-e2e.yaml')
    const job = workflow.jobs?.['upload-e2e-coverage']

    expect(job?.needs).toContain(SHARDED)
    expect(job?.with?.shards_succeeded).toBe(
      `\${{ needs.${SHARDED}.result == 'success' }}`
    )
  })

  it('gates the saved E2E baseline on a whole merge', () => {
    const workflow = readWorkflow(
      '.github/workflows/coverage-slack-notify.yaml'
    )
    const steps = Object.values(workflow.jobs ?? {}).flatMap(
      (job) => job.steps ?? []
    )

    expect(steps.some((step) => step.id === 'e2e-meta')).toBe(true)

    const save = steps.find(
      (step) =>
        step.uses?.startsWith('actions/upload-artifact@') === true &&
        step.with?.name === 'e2e-coverage-baseline'
    )
    expect(save?.if).toContain("steps.e2e-meta.outputs.complete == 'true'")
    expect(save?.if).toContain('success()')
  })
})
