/**
 * Renders the error-severity findings from a `fallow audit --format json` run
 * as Markdown, for the explain-check section on a pull request.
 *
 * This exists because the findings are otherwise unreachable. GitHub renders at
 * most 10 annotations per type per step, and a repo-wide audit emits enough
 * warnings to crowd out the errors that actually fail the gate — on PR 17436
 * all ten visible annotations were pre-existing `package.json` warnings while
 * the two blocking findings were rendered nowhere at all.
 */
import { existsSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export interface CloneInstance {
  file: string
  start_line: number
  end_line: number
}

export interface ComplexityFinding {
  path: string
  name: string
  line: number
  cyclomatic: number
  crap: number
  severity: string
}

export interface FallowReport {
  /**
   * Fallow writes `{error, message, exit_code}` to stdout instead of a report
   * when the run itself fails — an unresolvable `--changed-since` ref is the
   * one you hit in practice. The action saves that envelope as
   * `fallow-results.json`, so the renderer sees it and must not mistake an
   * absence of findings for an absence of problems.
   */
  error?: boolean
  message?: string
  exit_code?: number
  verdict?: string
  changed_files_count?: number
  duplication?: { clone_groups?: { instances?: CloneInstance[] }[] }
  complexity?: { findings?: ComplexityFinding[] }
  dead_code?: {
    unused_files?: { path?: string }[]
    unused_exports?: { file?: string; name?: string; line?: number }[]
  }
}

/**
 * Values come from the audited tree, so a path or symbol can carry a `|`, a
 * backtick or a newline — each of which would end its table cell or code span
 * and corrupt every row after it.
 */
function cell(value: string | number): string {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/`/g, '\\`')
    .replace(/\r?\n/g, ' ')
}

/**
 * Sections arrive from a tool's stdout, so a shape change upstream must not
 * crash the renderer — a crash leaves the explainer empty, which is the exact
 * failure the error-envelope handling above exists to prevent.
 */
function asArray<T>(value: T[] | undefined): T[] {
  if (!Array.isArray(value)) return []
  // Members are filtered too, not just the container: a `null` entry would
  // throw on the first field read, and with `set -euo pipefail` the render
  // step then fails the whole job — strictly worse than an empty table.
  return value.filter(
    (entry): entry is T => typeof entry === 'object' && entry !== null
  )
}

export function renderCloneGroups(report: FallowReport): string[] {
  const groups = asArray(report.duplication?.clone_groups)
  return groups.flatMap((group) => {
    const instances = asArray(group.instances)
    if (instances.length < 2) return []
    const sites = instances
      .map(
        (i) => `\`${cell(i.file)}:${cell(i.start_line)}-${cell(i.end_line)}\``
      )
      .join('<br>')
    return [
      `| Duplication | ${instances.length}-way clone | ${sites} | Extract the shared fragment into one function the sites call. |`
    ]
  })
}

export function renderComplexity(report: FallowReport): string[] {
  const findings = asArray(report.complexity?.findings)
  return findings.map(
    (f) =>
      `| Complexity | \`${cell(f.name)}()\` — cyclomatic ${cell(f.cyclomatic)}, CRAP ${cell(f.crap)} | \`${cell(f.path)}:${cell(f.line)}\` | Extract a branch, or raise branch coverage — CRAP is \`CC² × (1−cov)³ + CC\`, so either moves it. |`
  )
}

export function renderDeadCode(report: FallowReport): string[] {
  const dc = report.dead_code
  const rows: string[] = []
  for (const file of asArray(dc?.unused_files)) {
    if (file.path) {
      rows.push(
        `| Dead code | unused file | \`${cell(file.path)}\` | Delete it, or declare it an entry point in \`.fallowrc.jsonc\`. |`
      )
    }
  }
  for (const exp of asArray(dc?.unused_exports)) {
    if (exp.file && exp.name) {
      rows.push(
        `| Dead code | unused export \`${cell(exp.name)}\` | \`${cell(exp.file)}${exp.line ? `:${cell(exp.line)}` : ''}\` | Remove the export, or declare it in \`.fallowrc.jsonc\` if it is public API. |`
      )
    }
  }
  return rows
}

export function renderReport(report: FallowReport): string {
  // Checked before the rows, because an errored run has no findings and would
  // otherwise render as "no new findings" underneath a red check.
  if (report.error === true) {
    return [
      'Fallow did not complete, so this PR was never actually audited — the',
      'red check is the tool failing, not a finding against your change.',
      '',
      `> ${cell(report.message ?? 'no message reported')}`,
      '',
      'That is a CI problem rather than yours. Re-run the job; if it persists,',
      'the audit step in `.github/workflows/ci-fallow.yaml` needs a look.'
    ].join('\n')
  }

  const rows = [
    ...renderCloneGroups(report),
    ...renderComplexity(report),
    ...renderDeadCode(report)
  ]

  if (rows.length === 0) {
    return report.verdict === 'fail'
      ? [
          'Fallow reports a failing verdict, but this renderer found no findings it',
          'knows how to describe. Open the run log and the `Audit new findings`',
          'step — and please extend `scripts/cicd/fallow-findings.ts` so the next',
          'person does not have to.'
        ].join('\n')
      : 'No new findings in the changed files.'
  }

  return [
    `Fallow gates on **new findings in changed files only**, so everything below was introduced or moved by this PR${
      report.changed_files_count
        ? ` (${report.changed_files_count} changed files)`
        : ''
    }.`,
    '',
    '| Kind | Finding | Where | Usual remedy |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
    'Pre-existing findings are baselined in `.fallow-baselines/` and are not your',
    'responsibility — see [ADR-DEVEX-LINT-0015](../../docs/adr/DEVEX-LINT-0015-adopt-fallow-with-new-only-baselines.md).'
  ].join('\n')
}

export function readReport(path: string): FallowReport {
  if (!existsSync(path)) {
    throw new Error(`fallow results file not found: ${path}`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch (cause) {
    // Reported as an errored run rather than thrown: a renderer crash would
    // replace the explainer with nothing at all, which is strictly worse than
    // saying the audit output was unreadable.
    return {
      error: true,
      message: `could not parse ${path}: ${(cause as Error).message}`
    }
  }
  if (parsed === null || typeof parsed !== 'object') {
    return { error: true, message: `unexpected fallow output in ${path}` }
  }
  return parsed as FallowReport
}

/* c8 ignore start -- CLI entry, exercised by the workflow rather than a unit test */
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [, , resultsPath] = process.argv
  if (!resultsPath) {
    console.error('usage: fallow-findings.ts <fallow-results.json>')
    process.exit(2)
  }
  process.stdout.write(renderReport(readReport(resultsPath)))
}
/* c8 ignore stop */
