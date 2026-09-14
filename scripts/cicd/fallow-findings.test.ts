import { describe, expect, it } from 'vitest'

import {
  type FallowReport,
  renderCloneGroups,
  renderComplexity,
  renderDeadCode,
  renderReport
} from './fallow-findings'

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
                REAL_REPORT.duplication!.clone_groups![0]!.instances![0]!
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

  it('tolerates a report with no sections at all', () => {
    expect(renderCloneGroups({})).toEqual([])
    expect(renderComplexity({})).toEqual([])
    expect(renderDeadCode({})).toEqual([])
  })
})
