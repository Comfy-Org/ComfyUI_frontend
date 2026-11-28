import { describe, expect, it } from 'vitest'

import type { RunEntry } from '@e2e/reporters/nodes2Acceptance/runIndex'
import { renderRunIndex } from '@e2e/reporters/nodes2Acceptance/runIndex'

function run(name: string, overrides: Partial<RunEntry> = {}): RunEntry {
  return {
    run: name,
    about: '',
    pages: [
      {
        folder: `${name}/main`,
        report: true,
        gallery: false,
        builds: ['main abc']
      }
    ],
    ...overrides
  }
}

describe('renderRunIndex', () => {
  it('lists runs newest first', () => {
    const html = renderRunIndex([
      run('2026-11-20_171106'),
      run('2026-11-23_132840')
    ])

    expect(html.indexOf('2026-11-23_132840')).toBeLessThan(
      html.indexOf('2026-11-20_171106')
    )
  })

  it('links each page a run produced, with the builds it tested and its description', () => {
    const html = renderRunIndex([
      run('2026-11-23_132840', {
        about: 'Layout survey',
        pages: [
          {
            folder: '2026-11-23_132840/inflight',
            report: false,
            gallery: true,
            builds: ['inflight 93a4b936e4']
          }
        ]
      })
    ])

    expect(html).toContain('href="2026-11-23_132840/inflight/layout.html"')
    expect(html).not.toContain('inflight/report.html')
    expect(html).toContain('inflight 93a4b936e4')
    expect(html).toContain('Layout survey')
  })

  it('leaves out folders with no report or gallery', () => {
    const html = renderRunIndex([
      run('2026-11-23_111700', {
        pages: [
          {
            folder: '2026-11-23_111700',
            report: false,
            gallery: false,
            builds: []
          }
        ]
      })
    ])

    expect(html).not.toContain('2026-11-23_111700')
  })

  it('lists only the folders of a run that hold a page', () => {
    const html = renderRunIndex([
      run('2026-11-20_171106', {
        pages: [
          {
            folder: '2026-11-20_171106',
            report: true,
            gallery: false,
            builds: []
          },
          {
            folder: '2026-11-20_171106/data',
            report: false,
            gallery: false,
            builds: []
          }
        ]
      })
    ])

    expect(html).not.toContain('2026-11-20_171106/data')
  })
})
