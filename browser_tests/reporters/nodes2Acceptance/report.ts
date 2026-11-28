import { stripVTControlCharacters } from 'node:util'

import type {
  Requirement,
  TestRef
} from '@e2e/reporters/nodes2Acceptance/requirements'
import { REQUIREMENTS } from '@e2e/reporters/nodes2Acceptance/requirements'

export type Renderer = 'classic' | 'nodes2' | 'both'

export interface RecordedTest {
  file: string
  describe: string
  title: string
  renderer: Renderer
  status: string
  error: string
  measurements: string[]
}

export interface ProjectData {
  project: string
  commit: string
  finishedAt: string
  tests: RecordedTest[]
}

export type Nodes2Status = 'pass' | 'fail' | 'testFailed' | 'notTested'
export type LitegraphStatus = 'pass' | 'fail' | 'none'

export interface Row {
  group: string
  description: string
  result: string
  litegraph: LitegraphStatus
  nodes2: Nodes2Status
}

export interface Section {
  title: string
  note: string
  commit: string
  finishedAt: string
  historical: boolean
  rows: Row[]
}

const ACCEPTANCE_CRITERIA_URL =
  'https://app.notion.com/p/41d6d73d365081dd807ff7e3623109a8'

const SECTIONS: Record<string, { title: string; note: string }> = {
  'nodes2-acceptance': {
    title: 'Node inputs',
    note: 'Each requirement runs on Litegraph (classic) and on Nodes 2.0 with the same steps; the required value is Litegraph’s.'
  },
  'nodes2-acceptance-packs': {
    title: 'Popular node packs',
    note: 'Real packs pinned to exact commits. A feature passes on Nodes 2.0 only if it works as it does on Litegraph.'
  },
  'nodes2-acceptance-perf': {
    title: 'Performance',
    note: 'Production build, headless Chromium. Ratios compare medians of interleaved Litegraph and Nodes 2.0 samples in one test, so the Litegraph column is blank for them.'
  }
}

export const isAcceptanceProject = (project: string) => project in SECTIONS

/** The assertion label and expected/received lines of a Playwright error. */
export function summariseError(message: string): string {
  const lines = stripVTControlCharacters(message)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length === 0) return ''
  const label = lines[0].replace(/^Error:\s*/, '')
  const expected = lines.find((line) => line.startsWith('Expected'))
  const received = lines.find((line) => line.startsWith('Received'))
  const detail = [expected, received].filter(Boolean)
  if (label.startsWith('expect(') && detail.length) return detail.join('; ')
  return [label, ...detail].join('; ')
}

function formatNumber(value: unknown) {
  if (typeof value !== 'number') return String(value)
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(value < 10 ? 2 : 1)
}

type Json = Record<string, unknown>

const REPORTED_SCALAR = /p95|median|worst|fps|busy/i

const isObject = (value: unknown): value is Json =>
  Boolean(value) && typeof value === 'object'

const joinPath = (path: string, key: string) => (path ? `${path} ${key}` : key)

function pairText(path: string, record: Json) {
  const classic = record.classic as Json
  const nodes2 = record.nodes2 as Json
  const ratio =
    typeof record.ratio === 'number' ? ` (${record.ratio.toFixed(2)}×)` : ''
  return `${path}: Litegraph ${formatNumber(classic.median)}, Nodes 2.0 ${formatNumber(nodes2.median)}${ratio}`
}

function measurementParts(value: unknown, path: string): string[] {
  if (!isObject(value)) return []
  if (isObject(value.classic) && isObject(value.nodes2))
    return [pairText(path, value)]
  return Object.entries(value).flatMap(([key, child]) =>
    childParts(path, key, child)
  )
}

function childParts(path: string, key: string, child: unknown): string[] {
  if (key === 'scenario') return []
  if (isObject(child)) return measurementParts(child, joinPath(path, key))
  if (typeof child === 'number' && REPORTED_SCALAR.test(key))
    return [`${joinPath(path, key)} ${formatNumber(child)}`]
  return []
}

/** One line per Litegraph/Nodes 2.0 pair in a perf measurement annotation. */
export function summariseMeasurement(json: string): string {
  try {
    return measurementParts(JSON.parse(json), '').join('; ')
  } catch {
    return json
  }
}

const matches = (ref: TestRef) => (test: RecordedTest) =>
  test.title === ref.title &&
  (!ref.context || test.describe.includes(ref.context))

interface RefRuns {
  ref: TestRef
  classic: RecordedTest[]
  subject: RecordedTest[]
}

const consistent = (runs: RecordedTest[]) =>
  runs.every((run) => run.status === runs[0].status)

const statuses = (runs: RecordedTest[]) =>
  runs.map((run) => run.status).join(', ')

function testedRuns(refs: TestRef[], tests: RecordedTest[]): RefRuns[] {
  return refs.map((ref) => {
    const runs = tests.filter(matches(ref))
    return {
      ref,
      classic: runs.filter((run) => run.renderer === 'classic'),
      subject: runs.filter((run) => run.renderer !== 'classic')
    }
  })
}

function litegraphStatus(classicRuns: RecordedTest[]): LitegraphStatus {
  if (classicRuns.length === 0) return 'none'
  return classicRuns.every((run) => run.status === 'passed') ? 'pass' : 'fail'
}

function labelled(tested: RefRuns[], entry: RefRuns, text: string) {
  return tested.length > 1 ? `${entry.ref.title}: ${text}` : text
}

function invalidResult(tested: RefRuns[]): string | undefined {
  const inconsistent = tested.filter(
    (entry) => !consistent(entry.subject) || !consistent(entry.classic)
  )
  if (inconsistent.length)
    return inconsistent
      .map((entry) =>
        labelled(
          tested,
          entry,
          `inconsistent across repeated runs (${statuses(entry.subject)})`
        )
      )
      .join(' | ')
  const classicFailure = tested
    .flatMap((entry) => entry.classic)
    .find((run) => run.status !== 'passed')
  if (classicFailure)
    return `Litegraph control failed, so the Nodes 2.0 result is not valid: ${classicFailure.error}`
  const incompleteComparison = tested
    .flatMap((entry) => entry.subject)
    .find(
      (run) =>
        run.file === 'performance.ratios.spec.ts' &&
        run.measurements.length === 0
    )
  if (incompleteComparison)
    return `Comparison did not complete: ${incompleteComparison.error || incompleteComparison.status}`
  const unfinished = tested
    .flatMap((entry) => entry.subject)
    .find((run) => run.status !== 'passed' && run.status !== 'failed')
  if (unfinished) return `Test ${unfinished.status} before reaching a result`
  const missing = tested.filter(
    (entry) =>
      entry.subject.length === 0 ||
      (entry.classic.length === 0 &&
        entry.subject.some((run) => run.renderer === 'nodes2'))
  )
  if (missing.length)
    return missing
      .map((entry) =>
        labelled(
          tested,
          entry,
          entry.subject.length === 0
            ? 'Missing Nodes 2.0 result'
            : 'Missing Litegraph control'
        )
      )
      .join(' | ')
  return undefined
}

function measuredResult(runs: RecordedTest[]) {
  return [...new Set(runs.flatMap((run) => run.measurements))]
    .map(summariseMeasurement)
    .filter(Boolean)
    .join(' | ')
}

function outcome(tested: RefRuns[]): Pick<Row, 'nodes2' | 'result'> {
  const failed = tested.filter((entry) =>
    entry.subject.some((run) => run.status === 'failed')
  )
  const measured = measuredResult(tested.flatMap((entry) => entry.subject))
  if (failed.length === 0)
    return {
      nodes2: 'pass',
      result: measured || 'Meets the requirement'
    }
  const errors = failed
    .map((entry) => labelled(tested, entry, entry.subject.at(-1)!.error))
    .join(' | ')
  return { nodes2: 'fail', result: measured || errors }
}

function rowFor(requirement: Requirement, tests: RecordedTest[]): Row {
  const base = { group: requirement.group, description: requirement.text }
  const refs = requirement.tests ?? []
  const tested = testedRuns(refs, tests)
  if (
    tested.every((entry) => entry.classic.length + entry.subject.length === 0)
  )
    return {
      ...base,
      litegraph: 'none',
      nodes2: 'notTested',
      result:
        requirement.notTested ??
        (refs.length ? 'No result for this requirement in this run.' : '')
    }
  const litegraph = litegraphStatus(tested.flatMap((entry) => entry.classic))
  const invalid = invalidResult(tested)
  if (invalid)
    return { ...base, litegraph, nodes2: 'testFailed', result: invalid }
  return { ...base, litegraph, ...outcome(tested) }
}

function unmappedRows(project: string, tests: RecordedTest[]): Row[] {
  const refs = (REQUIREMENTS[project] ?? []).flatMap((r) => r.tests ?? [])
  const unmapped = tests.filter(
    (test) => !refs.some((ref) => matches(ref)(test))
  )
  const titles = [...new Set(unmapped.map((test) => test.title))]
  return titles.map((title) =>
    rowFor({ group: 'Other tests', text: title, tests: [{ title }] }, unmapped)
  )
}

/** One row per document requirement, plus any test not mapped to one. */
export function buildSection(data: ProjectData): Section {
  const config = SECTIONS[data.project]
  const rows = [
    ...(REQUIREMENTS[data.project] ?? []).map((requirement) =>
      rowFor(requirement, data.tests)
    ),
    ...unmappedRows(data.project, data.tests)
  ]
  return {
    title: config.title,
    note: config.note,
    commit: data.commit,
    finishedAt: data.finishedAt,
    historical: false,
    rows
  }
}

export function totals(rows: Row[]) {
  const nodes2 = (status: Nodes2Status) =>
    rows.filter((row) => row.nodes2 === status).length
  const litegraph = (status: LitegraphStatus) =>
    rows.filter((row) => row.litegraph === status).length
  return {
    total: rows.length,
    passes: nodes2('pass'),
    failures: nodes2('fail'),
    testFailures: nodes2('testFailed'),
    notTested: nodes2('notTested'),
    litegraphPasses: litegraph('pass'),
    litegraphFailures: litegraph('fail')
  }
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const NODES2_CELL: Record<Nodes2Status, string> = {
  pass: '<td class="pass">✅ PASS</td>',
  fail: '<td class="fail">❌ FAIL</td>',
  testFailed: '<td class="warn">⚠️ TEST FAILED</td>',
  notTested: '<td class="none">⏭️ NOT TESTED</td>'
}

const LITEGRAPH_CELL: Record<LitegraphStatus, string> = {
  pass: '<td class="pass">✅ PASS</td>',
  fail: '<td class="fail">❌ FAIL</td>',
  none: '<td class="none">—</td>'
}

function totalsText(t: ReturnType<typeof totals>) {
  const parts = [
    `<span class="pass">✅ ${t.passes} passed</span>`,
    `<span class="fail">❌ ${t.failures} failed</span>`,
    ...(t.testFailures
      ? [`<span class="warn">⚠️ ${t.testFailures} test failed</span>`]
      : []),
    ...(t.notTested
      ? [`<span class="none">⏭️ ${t.notTested} not tested</span>`]
      : [])
  ]
  return `${t.total} requirements — Nodes 2.0: ${parts.join(', ')}. Litegraph: ✅ ${t.litegraphPasses} passed, ❌ ${t.litegraphFailures} failed`
}

function sectionHtml(section: Section) {
  const body = section.rows
    .map((row, index) => {
      const heading =
        index === 0 || section.rows[index - 1].group !== row.group
          ? `<tr><th colspan="4" class="group">${escapeHtml(row.group)}</th></tr>\n`
          : ''
      return `${heading}<tr><td>${escapeHtml(row.description)}</td><td>${escapeHtml(row.result)}</td>${LITEGRAPH_CELL[row.litegraph]}${NODES2_CELL[row.nodes2]}</tr>`
    })
    .join('\n')
  return `<h2>${escapeHtml(section.title)}</h2>
<p>${escapeHtml(section.note)}</p>
<p>${section.historical ? 'Historical evidence — excluded from current totals. ' : ''}${section.commit ? `Frontend ${escapeHtml(section.commit)} · finished ${escapeHtml(section.finishedAt)}` : 'No evidence collected.'}</p>
<table>
<tr><th>Requirement</th><th>Result</th><th>Litegraph</th><th>Nodes 2.0</th></tr>
${body}
<tr class="total"><td colspan="4">Section total: ${totalsText(totals(section.rows))}</td></tr>
</table>`
}

function summaryRow(title: string, t: ReturnType<typeof totals>) {
  return `<tr><td>${escapeHtml(title)}</td><td>${t.total}</td><td class="pass">✅ ${t.passes}</td><td class="fail">❌ ${t.failures}</td><td class="warn">${t.testFailures ? `⚠️ ${t.testFailures}` : '0'}</td><td class="none">${t.notTested ? `⏭️ ${t.notTested}` : '0'}</td><td>✅ ${t.litegraphPasses} / ❌ ${t.litegraphFailures}</td></tr>`
}

export function renderReport(
  sections: Section[],
  commits: string[],
  generatedAt: string
) {
  const current = sections.filter((section) => !section.historical)
  const overall = totals(current.flatMap((section) => section.rows))
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Nodes 2.0 acceptance test report</title>
<style>
body { font-family: system-ui, sans-serif; font-size: 12pt; margin: 24px; }
table { border-collapse: collapse; width: 100%; margin-bottom: 8px; }
th, td { border: 1px solid #999; padding: 6px 8px; text-align: left; vertical-align: top; }
th.group { background: #eee; }
td.pass, span.pass { color: #080; font-weight: bold; white-space: nowrap; }
td.fail, span.fail { color: #c00; font-weight: bold; white-space: nowrap; }
td.warn, span.warn { color: #a60; font-weight: bold; white-space: nowrap; }
td.none, span.none { color: #777; white-space: nowrap; }
tr.total td { font-weight: bold; }
</style>
</head>
<body>
<h1>Nodes 2.0 acceptance test report</h1>
<p>Frontend ${escapeHtml([...new Set(commits)].join(', '))} · generated ${escapeHtml(generatedAt)}</p>
<p>Acceptance criteria: <a href="${ACCEPTANCE_CRITERIA_URL}">Acceptance Tests for Nodes 2.0</a></p>
<p>This report tests the <b>current</b> acceptance criteria, nothing more and nothing less. If an item isn’t worth testing, or something we need is missing, comment on the <a href="${ACCEPTANCE_CRITERIA_URL}">acceptance criteria page</a> or bring it to #proj-frontend, and we will remove or add it. Items we can’t yet test reliably are listed as ⏭️ NOT TESTED with the reason, so nothing is silently left out.</p>
<p><b>Entire test: ${totalsText(overall)}</b></p>
${sections.map(sectionHtml).join('\n')}
<h2>Totals</h2>
<table>
<tr><th>Section</th><th>Requirements</th><th>Nodes 2.0 passed</th><th>Nodes 2.0 failed</th><th>Test failed</th><th>Not tested</th><th>Litegraph</th></tr>
${current.map((section) => summaryRow(section.title, totals(section.rows))).join('\n')}
${summaryRow('Entire test', overall)}
</table>
</body>
</html>
`
}

/** Every section in suite order; a project with no data shows all its requirements as not tested. */
export function orderedSections(
  data: ProjectData[],
  currentCommit?: string
): Section[] {
  return Object.keys(SECTIONS).flatMap((project) => {
    const entry = data.find((entry) => entry.project === project)
    const empty = { project, commit: '', finishedAt: '', tests: [] }
    if (entry && currentCommit && entry.commit !== currentCommit)
      return [buildSection(empty), { ...buildSection(entry), historical: true }]
    return [buildSection(entry ?? empty)]
  })
}
