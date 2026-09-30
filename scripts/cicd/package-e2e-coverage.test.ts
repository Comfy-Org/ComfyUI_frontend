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

function readWorkflow(path: string): unknown {
  return parse(readFileSync(path, 'utf8'))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Reads a nested field without asserting a shape the YAML never proved. */
function field(source: unknown, ...path: string[]): unknown {
  return path.reduce<unknown>(
    (current, key) => (isRecord(current) ? current[key] : undefined),
    source
  )
}

function jobSteps(workflow: unknown): unknown[] {
  const jobs = field(workflow, 'jobs')
  if (!isRecord(jobs)) return []
  return Object.values(jobs).flatMap((job) => {
    const steps = field(job, 'steps')
    return Array.isArray(steps) ? steps : []
  })
}

function isE2eCoverageUpload(step: unknown): boolean {
  const uses = field(step, 'uses')
  return (
    typeof uses === 'string' &&
    uses.startsWith('actions/upload-artifact@') &&
    field(step, 'with', 'name') === 'e2e-coverage'
  )
}

function uploadedCoveragePaths(file: string): string[] {
  return jobSteps(readWorkflow(file))
    .filter(isE2eCoverageUpload)
    .flatMap((step) => String(field(step, 'with', 'path') ?? '').split('\n'))
    .map((entry) => entry.trim().replace(/\/$/, ''))
    .filter(Boolean)
}

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
    run(shardsSucceeded: string | boolean = true) {
      const result = spawnSync(
        'bash',
        [
          SCRIPT,
          shards,
          output,
          html,
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
  it('marks a merge complete when the shard matrix passed', () => {
    using fixture = coverageFixture()
    fixture.writeShard('e2e-coverage-shard-1', coverage('src'))
    fixture.writeShard('e2e-coverage-shard-2', coverage('src'))

    const result = fixture.run(true)

    expect(result.status).toBe(0)
    expect(readFileSync(fixture.githubOutput, 'utf8')).toBe(
      'has-coverage=true\ncomplete=true\n'
    )
    expect(readMetadata(fixture.output)).toEqual({
      complete: true,
      sourceSha: 'abc1234def5678'
    })
    expect(result.output).not.toContain('::warning::')
  })

  // Preserves #15342: a flaky shard must not discard every other shard's real
  // coverage. It stays published for Codecov and the PR comment, but flagged.
  it('publishes a run with a whitespace path but flags a red matrix', () => {
    using fixture = coverageFixture()
    fixture.writeShard('failed shard 1', coverage('src'))

    const result = fixture.run(false)

    expect(result.status).toBe(0)
    expect(readFileSync(fixture.githubOutput, 'utf8')).toBe(
      'has-coverage=true\ncomplete=false\n'
    )
    expect(readMetadata(fixture.output)).toEqual({
      complete: false,
      sourceSha: 'abc1234def5678'
    })
    expect(result.output).toContain(
      '::warning::E2E coverage is not verified as a whole merge'
    )
    expect(
      readFileSync(join(fixture.output, 'coverage.lcov'), 'utf8')
    ).toContain('SF:src/file 0.ts')

    const summary = readFileSync(fixture.summary, 'utf8')
    expect(summary).toContain('failed shard 1')
    expect(summary).toContain('the shard matrix did not pass')
    expect(existsSync(join(fixture.html, 'index.html'))).toBe(true)
  })

  it('rejects a non-boolean shards-succeeded flag', () => {
    using fixture = coverageFixture()
    fixture.writeShard('e2e-coverage-shard-1', coverage('src'))

    const result = fixture.run('yes')

    expect(result.status).toBe(1)
    expect(result.output).toContain(
      "shards-succeeded must be 'true' or 'false'"
    )
  })

  it('skips successfully when no shard artifacts exist', () => {
    using fixture = coverageFixture()

    const result = fixture.run()

    expect(result.status).toBe(0)
    expect(readFileSync(fixture.githubOutput, 'utf8')).toBe(
      'has-coverage=false\n'
    )
    expect(existsSync(join(fixture.output, 'coverage.lcov'))).toBe(false)
  })

  it('fails when coverage is not mapped to repository sources', () => {
    using fixture = coverageFixture()
    fixture.writeShard('served-bundle', coverage('assets'))

    const result = fixture.run()

    expect(result.status).toBe(1)
    expect(result.output).toContain('Only 0 files under src/ or packages/')
    expect(existsSync(join(fixture.html, 'index.html'))).toBe(false)
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
    expect(uploadedCoveragePaths(file)).toEqual(['coverage/playwright'])
  })
})

// actionlint is not wired into CI, so these assertions are the only automated
// guard on the two predicates that decide whether a number is trustworthy.
describe('completeness gate wiring', () => {
  const SHARDED = 'playwright-tests-chromium-sharded'

  // The matrix can only stand in for completeness while a shard that produced
  // no coverage fails here. Soften this and shards go missing silently again.
  it('fails a shard whose coverage upload finds nothing', () => {
    const upload = jobSteps(
      readWorkflow('.github/workflows/ci-tests-e2e.yaml')
    ).find(
      (step) =>
        field(step, 'with', 'name') ===
        'e2e-coverage-shard-${{ matrix.shardIndex }}'
    )

    expect(field(upload, 'with', 'if-no-files-found')).toBe('error')
  })

  it('derives shards_succeeded from the sharded matrix verdict', () => {
    const job = field(
      readWorkflow('.github/workflows/ci-tests-e2e.yaml'),
      'jobs',
      'upload-e2e-coverage'
    )

    expect(field(job, 'needs')).toContain(SHARDED)
    expect(field(job, 'with', 'shards_succeeded')).toBe(
      `\${{ needs.${SHARDED}.result == 'success' }}`
    )
  })

  it('gates the saved E2E baseline on a whole merge', () => {
    const steps = jobSteps(
      readWorkflow('.github/workflows/coverage-slack-notify.yaml')
    )
    const save = steps.find(
      (step) =>
        field(step, 'with', 'name') === 'e2e-coverage-baseline' &&
        String(field(step, 'uses')).startsWith('actions/upload-artifact@')
    )

    expect(steps.map((step) => field(step, 'id')).filter(Boolean)).toContain(
      'e2e-meta'
    )
    expect(field(save, 'if')).toContain(
      "steps.e2e-meta.outputs.complete == 'true'"
    )
    expect(field(save, 'if')).toContain('success()')
  })
})
// The measurement policies themselves are covered by
// coverage-unit-baseline.test.ts, coverage-e2e-order.test.ts, and
// post-slack-coverage-report.test.ts. What is left here is the wiring that
// decides whether those policies run at all.
describe('per-merge measurement wiring', () => {
  const NOTIFY = '.github/workflows/coverage-slack-notify.yaml'

  function notifyStep(predicate: (step: unknown) => boolean): unknown {
    return jobSteps(readWorkflow(NOTIFY)).find(predicate)
  }

  // Deleting any one of these leaves the module it calls as dead code that
  // its own suite still happily covers.
  it('runs the extracted scripts rather than inline copies of them', () => {
    const commands = jobSteps(readWorkflow(NOTIFY)).map((step) =>
      String(field(step, 'run') ?? '')
    )

    expect(commands).toContain(
      'pnpm exec tsx scripts/cicd/coverage-unit-baseline.ts'
    )
    expect(commands).toContain(
      'pnpm exec tsx scripts/cicd/coverage-e2e-order.ts'
    )
    expect(commands).toContain('scripts/cicd/post-slack-coverage-report.sh')
  })

  // Resolving by commit here would re-pick the newest run for that sha —
  // including a cancelled one, whose tracefile may be truncated — and discard
  // the verdict check that chose this run.
  it('downloads the ancestor baseline by resolved run id, not by commit', () => {
    const download = notifyStep(
      (step) => field(step, 'with', 'path') === 'temp/coverage-baseline'
    )

    expect(field(download, 'with', 'run_id')).toBe(
      '${{ steps.unit-baseline.outputs.run-id }}'
    )
    expect(field(download, 'with', 'commit')).toBeUndefined()
    expect(field(download, 'with', 'workflow_conclusion')).toBeUndefined()
  })

  // Coverage floors live in the same step that merges the shard reports, so a
  // regression past a floor fails the run. Reporting only successes skipped
  // exactly the regressions and let the next delta subtract them out.
  it('reports merges whose unit run failed, not just successes', () => {
    const condition = String(
      field(readWorkflow(NOTIFY), 'jobs', 'notify', 'if')
    )

    expect(condition).toContain(
      'contains(fromJSON(\'["success", "failure"]\'), github.event.workflow_run.conclusion)'
    )
    // Absent coverage has to leave unit out rather than redden the notifier,
    // but an API or extraction failure still should. Matched on path: the
    // ancestor download also carries a run_id.
    const current = notifyStep(
      (step) => field(step, 'with', 'path') === 'coverage'
    )
    expect(field(current, 'with', 'if_no_artifact_found')).toBe('warn')
    expect(field(current, 'continue-on-error')).toBeUndefined()
  })

  it('stores no unit baseline artifact', () => {
    const saves = jobSteps(readWorkflow(NOTIFY)).filter((step) =>
      String(field(step, 'uses')).startsWith('actions/upload-artifact@')
    )

    expect(saves.map((step) => field(step, 'with', 'name'))).toEqual([
      'e2e-coverage-baseline'
    ])
  })

  // E2E has no per-commit artifact to pin, so it can be measured on a commit
  // this one does not contain and would be credited to the wrong PR.
  it('gates the E2E row and its baseline on the ordering check', () => {
    // The download step carries the same artifact name, so match the upload.
    const save = notifyStep(
      (step) =>
        field(step, 'with', 'name') === 'e2e-coverage-baseline' &&
        String(field(step, 'uses')).startsWith('actions/upload-artifact@')
    )

    expect(
      jobSteps(readWorkflow(NOTIFY)).map((step) => field(step, 'id'))
    ).toContain('e2e-order')
    expect(String(field(save, 'if'))).toContain(
      "steps.e2e-order.outputs.usable == 'true'"
    )
    expect(String(field(save, 'if'))).toContain('success()')
  })

  // continue-on-error would keep the run green and let success() advance the
  // baseline past a report that was never delivered.
  it('lets a failed Slack post fail the run', () => {
    const post = notifyStep((step) => field(step, 'id') === 'slack-post')

    expect(field(post, 'continue-on-error')).toBeUndefined()
  })
})
