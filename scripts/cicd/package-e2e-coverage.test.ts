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

// Every merge has to be measured, and each one compared against its own
// parent. Both properties live entirely in workflow expressions, so nothing
// else in the suite notices when one is softened.
describe('per-merge measurement wiring', () => {
  const NOTIFY = '.github/workflows/coverage-slack-notify.yaml'

  function notifyStep(predicate: (step: unknown) => boolean): unknown {
    return jobSteps(readWorkflow(NOTIFY)).find(predicate)
  }

  // Sharing a group across main pushes is what let one merge cancel the run
  // measuring the merge before it, which is the bug this wiring exists to fix.
  it('keeps main pushes out of each other concurrency group', () => {
    const group = field(
      readWorkflow('.github/workflows/ci-tests-unit.yaml'),
      'concurrency',
      'group'
    )

    expect(group).toContain('github.sha')
    expect(group).toContain("github.ref == 'refs/heads/main'")
    // Dropping the ref lets the same commit pushed to a release branch share
    // main's group and cancel it.
    expect(group).toContain('github.ref }}-')
  })

  // `single`, the default, cancels every pending run but the newest, which
  // would drop exactly the reports this workflow exists to send.
  it('queues overlapping notify runs rather than dropping them', () => {
    const concurrency = field(readWorkflow(NOTIFY), 'concurrency')

    expect(field(concurrency, 'queue')).toBe('max')
    expect(field(concurrency, 'cancel-in-progress')).toBe(false)
  })

  // A rolling baseline is shared mutable state: read and written out of merge
  // order once merges are measured in parallel. An ancestor's artifact is not.
  // Resolving by commit here would re-pick the newest run for that sha —
  // including a cancelled one, whose tracefile may be truncated — and discard
  // the verdict check that chose this run.
  it('downloads the ancestor baseline by resolved run id, not by commit', () => {
    const download = notifyStep(
      (step) => field(step, 'with', 'path') === 'temp/coverage-baseline'
    )

    expect(field(download, 'with', 'run_id')).toBe(
      '${{ steps.pr-meta.outputs.baseline-run-id }}'
    )
    expect(field(download, 'with', 'commit')).toBeUndefined()
    expect(field(download, 'with', 'workflow_conclusion')).toBeUndefined()
  })

  // Merge-queue batches leave intermediate commits with no push run, a
  // parent's own run can still be in flight, and a cancelled run's tracefile
  // may be truncated. Pinning the raw parent reports nothing in each case.
  it('walks back to the nearest ancestor that reached a verdict', () => {
    const resolve = String(
      field(
        notifyStep((step) => field(step, 'id') === 'pr-meta'),
        'with',
        'script'
      )
    )

    expect(resolve).toContain('MAX_HOPS')
    expect(resolve).toContain("run.conclusion !== 'success'")
    expect(resolve).toContain("run.conclusion !== 'failure'")
    expect(resolve).toContain('baseline-run-id')
  })

  // Coverage floors live in the same step that merges the shard reports, so a
  // regression past a floor fails the run. Reporting only successes skipped
  // exactly the regressions and let the next delta subtract them out.
  it('reports merges whose unit run failed, not just successes', () => {
    const condition = String(
      field(readWorkflow(NOTIFY), 'jobs', 'notify', 'if')
    )

    expect(condition).toContain('success')
    expect(condition).toContain('failure')
    // Absent coverage has to leave unit out rather than redden the notifier.
    // Matched on path: the ancestor download also carries a run_id.
    const current = notifyStep(
      (step) => field(step, 'with', 'path') === 'coverage'
    )
    expect(field(current, 'with', 'if_no_artifact_found')).toBe('warn')
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

  // Slack answers 200 with ok:false, so without this a rejected post reads as
  // delivered and the baseline advances past movement nobody ever saw.
  it('fails the run on a Slack-level rejection', () => {
    const post = notifyStep((step) => field(step, 'id') === 'slack-post')

    expect(String(field(post, 'run'))).toContain("jq -r '.ok'")
    // continue-on-error would keep the run green and let success() advance the
    // baseline past a report that was never delivered.
    expect(field(post, 'continue-on-error')).toBeUndefined()
  })

  // Serialised runs queue behind a hung one, so the default 6h is far too long.
  it('bounds how long one run can block the queue', () => {
    expect(
      field(readWorkflow(NOTIFY), 'jobs', 'notify', 'timeout-minutes')
    ).toBe(10)
  })
})
