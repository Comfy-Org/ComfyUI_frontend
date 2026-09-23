import { rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  readReport,
  renderCloneGroups,
  renderComplexity,
  renderDeadCode,
  renderReport
} from './fallow-findings'
import type { FallowReport } from './fallow-findings'

/**
 * The shape below is the real one: it is the abridged output of
 * `fallow audit --format json` against PR 17436, which is the run that motivated
 * this renderer.
 */
const REAL_REPORT: FallowReport = {
  verdict: 'fail',
  changed_files_count: 15,
  duplication: {
    clone_groups: [
      {
        instances: [
          {
            file: 'packages/account/src/core/billing/capabilities.ts',
            start_line: 160,
            end_line: 176
          },
          {
            file: 'packages/account/src/core/billing/credits.ts',
            start_line: 78,
            end_line: 93
          },
          {
            file: 'packages/account/src/core/billing/status.ts',
            start_line: 62,
            end_line: 77
          }
        ]
      }
    ]
  },
  complexity: {
    findings: [
      {
        path: 'packages/account/src/core/billing/capabilities.ts',
        name: 'read',
        line: 214,
        cyclomatic: 13,
        crap: 49.5,
        severity: 'moderate'
      }
    ]
  }
}

let fixtureN = 0

/**
 * Writes a fixture to disk and loads it the way the CLI does. Fixtures stay
 * `unknown` so a malformed report is never cast into a shape the parser is
 * supposed to be the one deciding about.
 */
function readFixture(value: unknown): FallowReport {
  const path = join(
    tmpdir(),
    `fallow-fixture-${process.pid}-${fixtureN++}.json`
  )
  writeFileSync(path, JSON.stringify(value))
  try {
    return readReport(path)
  } finally {
    rmSync(path, { force: true })
  }
}

describe('fallow findings renderer', () => {
  it('renders every finding that failed the real gate', () => {
    const md = renderReport(REAL_REPORT)

    // The two findings that failed PR 17436 and were invisible in the UI.
    expect(md).toContain('3-way clone')
    expect(md).toContain('capabilities.ts:160-176')
    expect(md).toContain('credits.ts:78-93')
    expect(md).toContain('status.ts:62-77')
    expect(md).toContain('cyclomatic 13')
    expect(md).toContain('capabilities.ts:214')
  })

  it('says findings are scoped to the diff, so nobody inherits the backlog', () => {
    const md = renderReport(REAL_REPORT)
    expect(md).toContain('new findings in changed files only')
    expect(md).toContain('.fallow-baselines/')
  })

  it('reports a clean audit plainly', () => {
    expect(renderReport({ verdict: 'pass' })).toBe(
      'No new findings in the changed files.'
    )
  })

  it('never claims a clean audit when the verdict failed', () => {
    // A fail we cannot describe must send the reader somewhere useful rather
    // than printing "no findings" under a red check.
    const md = renderReport({ verdict: 'fail' })
    expect(md).not.toContain('No new findings')
    expect(md).toContain('Audit new findings')
    expect(md).toContain('fallow-findings.ts')
  })

  it('ignores a clone group that has only one instance', () => {
    expect(
      renderCloneGroups({
        duplication: {
          clone_groups: [
            {
              instances: [
                REAL_REPORT.duplication!.clone_groups![0].instances![0]
              ]
            }
          ]
        }
      })
    ).toEqual([])
  })

  it('renders dead code with an escape hatch for intentional exports', () => {
    const rows = renderDeadCode({
      dead_code: {
        unused_files: [{ path: 'src/gone.ts' }],
        unused_exports: [{ file: 'src/api.ts', name: 'publicThing', line: 4 }]
      }
    })
    expect(rows).toHaveLength(2)
    expect(rows[0]).toContain('src/gone.ts')
    expect(rows[1]).toContain('publicThing')
    expect(rows[1]).toContain('.fallowrc.jsonc')
  })

  it('never reports a clean audit when fallow itself errored', () => {
    // The real envelope, from an unresolvable --changed-since ref.
    const md = renderReport({
      error: true,
      message:
        "could not determine changed files for base ref '7452fd7e'. Verify the ref exists in this git repository",
      exit_code: 2
    })

    expect(md).not.toContain('No new findings')
    expect(md).toContain('never actually audited')
    expect(md).toContain('7452fd7e')
  })

  it('turns unreadable fallow output into an errored run, not a crash', () => {
    const bad = join(tmpdir(), `fallow-bad-${process.pid}.json`)
    writeFileSync(bad, 'not json at all')
    try {
      const report = readReport(bad)
      expect(report.error).toBe(true)
      expect(renderReport(report)).toContain('never actually audited')
    } finally {
      rmSync(bad, { force: true })
    }
  })

  it('escapes values that would otherwise break the table', () => {
    // Paths and symbol names come from the audited tree, so they can carry
    // characters that end a cell or a code span.
    const md = renderReport({
      verdict: 'fail',
      complexity: {
        findings: [
          {
            path: 'src/a|b.ts',
            name: 'we`ird',
            line: 1,
            cyclomatic: 2,
            crap: 3,
            severity: 'moderate'
          }
        ]
      }
    })

    expect(md).toContain('src/a\\|b.ts')
    expect(md).toContain('we\\`ird')
    // One row means one unescaped pipe count: 5 delimiters, no stray cell.
    const row = md.split('\n').find((l) => l.includes('Complexity'))!
    expect(row.match(/(?<!\\)\|/g)).toHaveLength(5)
  })

  it('survives a section whose shape changed upstream', () => {
    // Stays `unknown` and goes through readReport, so this exercises the real
    // file -> parse -> render boundary rather than an in-memory object that
    // could never arrive that way. Crashing here would leave the explainer
    // empty, which is the failure the error envelope exists to stop.
    const malformed: unknown = {
      verdict: 'fail',
      duplication: { clone_groups: {} },
      complexity: { findings: 'nope' },
      dead_code: { unused_files: 7 }
    }
    expect(() => renderReport(readFixture(malformed))).not.toThrow()
  })

  it('survives null and wrong-shaped members inside a section', () => {
    // Containers that are arrays but whose members are not objects. The
    // renderer must not throw on the first field read.
    const malformed: unknown = {
      verdict: 'fail',
      duplication: { clone_groups: [null, 'x'] },
      complexity: { findings: [null, 3] },
      dead_code: { unused_files: [null], unused_exports: [null] }
    }
    expect(renderReport(readFixture(malformed))).not.toContain(
      'No new findings'
    )
  })

  it('reads a real fallow error envelope through readReport', () => {
    const envelope: unknown = { error: true, message: 'boom', exit_code: 2 }
    expect(renderReport(readFixture(envelope))).toContain(
      'never actually audited'
    )
  })

  it('tolerates a report with no sections at all', () => {
    expect(renderCloneGroups({})).toEqual([])
    expect(renderComplexity({})).toEqual([])
    expect(renderDeadCode({})).toEqual([])
  })
})
