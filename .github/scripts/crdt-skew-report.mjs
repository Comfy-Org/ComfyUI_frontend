#!/usr/bin/env node
/**
 * Turn the vitest JSON report from the `CI: CRDT Skew Alarm` workflow into pass/fail
 * counts, a job summary, and a machine-readable artifact.
 *
 * The verdict is deliberately conservative: anything short of "the suite ran to
 * completion against upstream and passed" is reported as inconclusive rather than as an
 * all-clear, because a false all-clear is the one outcome this alarm exists to prevent.
 *
 * Usage:
 *   node .github/scripts/crdt-skew-report.mjs --report <vitest.json> --out <report.json>
 *
 * Environment (supplied by the workflow):
 *   CMP_PACKAGE, CMP_SHA, CMP_SPEC, PINNED_VERSION, TESTS_OUTCOME
 */
import {
  appendFileSync,
  existsSync,
  readFileSync,
  writeFileSync
} from 'node:fs'

function parseArgs(argv) {
  const args = { report: null, out: null }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--report') args.report = argv[++i]
    else if (argv[i] === '--out') args.out = argv[++i]
  }
  return args
}

function readVitestReport(reportPath) {
  if (!reportPath || !existsSync(reportPath)) {
    return { parsed: false, error: `no vitest report at ${reportPath}` }
  }
  let report
  try {
    report = JSON.parse(readFileSync(reportPath, 'utf8'))
  } catch (error) {
    return {
      parsed: false,
      error: `vitest report parse failed: ${error.message}`
    }
  }
  const failing = []
  for (const file of report.testResults ?? []) {
    for (const assertion of file.assertionResults ?? []) {
      if (assertion.status !== 'failed') continue
      failing.push({
        name: assertion.fullName || assertion.title || '(unnamed test)',
        file: file.name ?? null,
        message:
          (assertion.failureMessages ?? [])
            .join('\n')
            .split('\n')
            .slice(0, 6)
            .join('\n') || null
      })
    }
  }
  return {
    parsed: true,
    total: report.numTotalTests ?? null,
    passed: report.numPassedTests ?? null,
    failed: report.numFailedTests ?? null,
    pending: report.numPendingTests ?? null,
    suites_total: report.numTotalTestSuites ?? null,
    suites_failed: report.numFailedTestSuites ?? null,
    failing_tests: failing
  }
}

/**
 * `no-skew-signal` is only allowed once the suite provably ran to completion and every
 * test passed. A zero `numFailedTests` is not sufficient on its own: vitest also reports
 * zero failures for a suite that was cancelled, that collected no tests at all, or that
 * skipped tests, and each of those would otherwise publish a cheerful all-clear about an
 * upstream revision nothing actually exercised.
 *
 * If the follower suite ever gains an intentional `test.skip` / `test.todo`, this gate
 * starts returning `inconclusive-incomplete-suite` on every run. That is deliberate:
 * account for the expected `pending` count here rather than dropping the
 * `passed === total` requirement.
 */
function verdictFor(tests, testsOutcome) {
  if (!tests.parsed) return 'inconclusive-no-report'
  if (tests.failed > 0) return 'skew-signal'
  if (testsOutcome !== 'success') return 'inconclusive-runner-failed'
  if (!Number.isInteger(tests.total) || tests.total <= 0) {
    return 'inconclusive-incomplete-suite'
  }
  if (tests.passed !== tests.total) return 'inconclusive-incomplete-suite'
  return 'no-skew-signal'
}

const { report: reportPath, out } = parseArgs(process.argv.slice(2))
const tests = readVitestReport(reportPath)
const verdict = verdictFor(tests, process.env.TESTS_OUTCOME)

const result = {
  schema: 'crdt-skew-alarm/1',
  generated_at: new Date().toISOString(),
  informational_only: true,
  premise: 'pin-vs-remote',
  package: process.env.CMP_PACKAGE ?? null,
  pinned_version: process.env.PINNED_VERSION ?? null,
  upstream_sha: process.env.CMP_SHA ?? null,
  upstream_spec: process.env.CMP_SPEC ?? null,
  tests_outcome: process.env.TESTS_OUTCOME ?? null,
  tests,
  verdict
}

const json = `${JSON.stringify(result, null, 2)}\n`
if (out) writeFileSync(out, json)
process.stdout.write(json)

const counts = tests.parsed
  ? `${tests.passed}/${tests.total} passed, ${tests.failed} failed, ${tests.pending} skipped`
  : `no counts available (${tests.error})`

const summary = [
  '## CRDT skew alarm',
  '',
  `Verdict: **${verdict}**`,
  '',
  `- Pinned: \`${result.package}@${result.pinned_version}\``,
  `- Upstream \`main\`: \`${result.upstream_sha}\``,
  `- Follower suite: ${counts}`,
  '',
  'This job is informational. It runs on a schedule and on manual dispatch only, so it',
  'never gates a pull request or the merge queue.',
  ''
]

if (tests.failing_tests?.length) {
  summary.push('### Failing tests', '')
  for (const failure of tests.failing_tests.slice(0, 25)) {
    summary.push(`- \`${failure.name}\``)
  }
  if (tests.failing_tests.length > 25) {
    summary.push(`- ...and ${tests.failing_tests.length - 25} more`)
  }
  summary.push('')
}

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary.join('\n')}\n`)
}
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    [
      `verdict=${verdict}`,
      `total=${tests.total ?? ''}`,
      `passed=${tests.passed ?? ''}`,
      `failed=${tests.failed ?? ''}`,
      ''
    ].join('\n')
  )
}
