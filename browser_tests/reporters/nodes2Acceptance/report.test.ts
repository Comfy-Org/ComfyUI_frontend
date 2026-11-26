import { describe, expect, it } from 'vitest'

import type {
  ProjectData,
  RecordedTest,
  Row
} from '@e2e/reporters/nodes2Acceptance/report'
import {
  buildSection,
  orderedSections,
  renderReport,
  summariseError,
  summariseMeasurement,
  totals
} from '@e2e/reporters/nodes2Acceptance/report'
import { REQUIREMENTS } from '@e2e/reporters/nodes2Acceptance/requirements'

const ROW_HEIGHT_TEST = 'widget rows are 20 px tall'
const ROW_HEIGHT_REQUIREMENT = 'Widget row height is 20 px'
const COMBO_UP_TEST =
  'arrow up from the first option of an open combo list wraps to the last'
const COMBO_RIGHT_TEST =
  'arrow right in an open combo list jumps to the last option'

function recorded(overrides: Partial<RecordedTest>): RecordedTest {
  return {
    file: 'inputs.core.spec.ts',
    describe: 'Node input acceptance: classic',
    title: ROW_HEIGHT_TEST,
    renderer: 'classic',
    status: 'passed',
    error: '',
    measurements: [],
    ...overrides
  }
}

function pair(
  classic: Partial<RecordedTest>,
  nodes2: Partial<RecordedTest>
): RecordedTest[] {
  return [
    recorded({ ...classic, renderer: 'classic' }),
    recorded({
      describe: 'Node input acceptance: Nodes 2.0',
      title: classic.title ?? ROW_HEIGHT_TEST,
      ...nodes2,
      renderer: 'nodes2'
    })
  ]
}

function rows(tests: RecordedTest[], project = 'nodes2-acceptance') {
  const data: ProjectData = {
    project,
    commit: 'abc',
    finishedAt: '2026-11-20T00:00:00Z',
    tests
  }
  return buildSection(data).rows
}

const rowNamed = (all: Row[], text: string) =>
  all.find((row) => row.description === text)!

describe('buildSection', () => {
  it('has one row per document requirement, in document order', () => {
    const texts = rows([]).map((row) => row.description)

    expect(texts).toEqual(
      REQUIREMENTS['nodes2-acceptance'].map((requirement) => requirement.text)
    )
  })

  it.for([
    ['passes on both renderers', 'passed', 'passed', 'pass', 'pass'],
    ['fails only on Nodes 2.0', 'passed', 'failed', 'pass', 'fail'],
    [
      'is a test failure when Litegraph fails',
      'failed',
      'failed',
      'fail',
      'testFailed'
    ],
    [
      'is a test failure when Nodes 2.0 times out',
      'passed',
      'timedOut',
      'pass',
      'testFailed'
    ]
  ] as const)(
    'a requirement that %s',
    ([, classicStatus, nodes2Status, litegraph, nodes2]) => {
      const row = rowNamed(
        rows(pair({ status: classicStatus }, { status: nodes2Status })),
        ROW_HEIGHT_REQUIREMENT
      )

      expect(row.litegraph).toBe(litegraph)
      expect(row.nodes2).toBe(nodes2)
    }
  )

  it('is a test failure when repeated runs disagree', () => {
    const row = rowNamed(
      rows([
        ...pair({}, { status: 'failed' }),
        ...pair({}, { status: 'passed' })
      ]),
      ROW_HEIGHT_REQUIREMENT
    )

    expect(row.nodes2).toBe('testFailed')
    expect(row.result).toContain('inconsistent')
  })

  it.for([
    ['classic only', 'classic', 'passed', 'pass', 'testFailed'],
    ['failed classic only', 'classic', 'failed', 'fail', 'testFailed'],
    ['Nodes 2.0 only', 'nodes2', 'passed', 'none', 'testFailed'],
    ['failed Nodes 2.0 only', 'nodes2', 'failed', 'none', 'testFailed'],
    ['single-session comparison passes', 'both', 'passed', 'none', 'pass'],
    ['single-session comparison fails', 'both', 'failed', 'none', 'fail']
  ] as const)(
    'requires complete evidence: %s',
    ([, renderer, status, litegraph, nodes2]) => {
      const row = rowNamed(
        rows([recorded({ renderer, status })]),
        ROW_HEIGHT_REQUIREMENT
      )

      expect(row).toMatchObject({ litegraph, nodes2 })
    }
  )

  it.for([
    ['no results', [], 'none', 'notTested'],
    [
      'one pair passes',
      pair({ title: COMBO_UP_TEST }, {}),
      'pass',
      'testFailed'
    ],
    [
      'one pair fails',
      pair({ title: COMBO_UP_TEST }, { status: 'failed' }),
      'pass',
      'testFailed'
    ],
    [
      'a sibling has only a passing control',
      [
        ...pair({ title: COMBO_UP_TEST }, {}),
        recorded({ title: COMBO_RIGHT_TEST })
      ],
      'pass',
      'testFailed'
    ],
    [
      'a sibling has only a failed control',
      [
        ...pair({ title: COMBO_UP_TEST }, {}),
        recorded({ title: COMBO_RIGHT_TEST, status: 'failed' })
      ],
      'fail',
      'testFailed'
    ],
    [
      'a sibling lacks its control',
      [
        ...pair({ title: COMBO_UP_TEST }, {}),
        recorded({ title: COMBO_RIGHT_TEST, renderer: 'nodes2' })
      ],
      'pass',
      'testFailed'
    ],
    [
      'both pairs pass',
      [
        ...pair({ title: COMBO_UP_TEST }, {}),
        ...pair({ title: COMBO_RIGHT_TEST }, {})
      ],
      'pass',
      'pass'
    ],
    [
      'a sibling is a single-session comparison',
      [
        ...pair({ title: COMBO_UP_TEST }, {}),
        recorded({ title: COMBO_RIGHT_TEST, renderer: 'both' })
      ],
      'pass',
      'pass'
    ]
  ] as const)(
    'requires every referenced test: %s',
    ([, runs, litegraph, nodes2]) => {
      const row = rowNamed(
        rows([...runs]),
        'Combo list keys: ↑/↓ wrap, ← first, → last'
      )

      expect(row).toMatchObject({ litegraph, nodes2 })
    }
  )

  it('shows the failure detail as the result', () => {
    const row = rowNamed(
      rows(pair({}, { status: 'failed', error: 'Expected: 20; Received: 24' })),
      ROW_HEIGHT_REQUIREMENT
    )

    expect(row.result).toBe('Expected: 20; Received: 24')
  })

  it('marks requirements without a result as not tested, with the reason', () => {
    const all = rows([])

    expect(rowNamed(all, ROW_HEIGHT_REQUIREMENT).nodes2).toBe('notTested')
    expect(rowNamed(all, 'Double-click window is 300 ms').result).toContain(
      'timing'
    )
  })

  it('shows a test that no requirement maps to under Other tests', () => {
    const all = rows(pair({ title: 'an extra check' }, {}))

    expect(all.at(-1)).toMatchObject({
      group: 'Other tests',
      description: 'an extra check',
      nodes2: 'pass'
    })
  })

  it('reports a single-session perf ratio with measurements and no Litegraph column', () => {
    const row = rowNamed(
      rows(
        [
          recorded({
            file: 'performance.ratios.spec.ts',
            describe:
              'Performance acceptance: Nodes 2.0 against classic › 1000 nodes',
            title:
              'loading reaches interactive within 1.5x classic time and heap',
            renderer: 'both',
            status: 'failed',
            measurements: [
              JSON.stringify({
                scenario: 'load',
                heap: {
                  classic: { median: 65 },
                  nodes2: { median: 640 },
                  ratio: 9.846
                }
              })
            ]
          })
        ],
        'nodes2-acceptance-perf'
      ),
      'Load at 1,000 nodes: time to interactive and heap within 1.5× classic'
    )

    expect(row).toMatchObject({
      litegraph: 'none',
      nodes2: 'fail',
      result: 'heap: Litegraph 65, Nodes 2.0 640 (9.85×)'
    })
  })
})

describe('orderedSections', () => {
  it('includes every section, even one with no data', () => {
    const sections = orderedSections([])

    expect(sections.map((section) => section.title)).toEqual([
      'Node inputs',
      'Popular node packs',
      'Performance'
    ])
    expect(
      sections.every((section) =>
        section.rows.every((row) => row.nodes2 === 'notTested')
      )
    ).toBe(true)
  })
})

describe('summariseError', () => {
  it('keeps the assertion label with expected and received values', () => {
    expect(
      summariseError(
        'Error: row height\n\nexpect(received).toBeCloseTo(expected)\n\nExpected: 20\nReceived: 24\n'
      )
    ).toBe('row height; Expected: 20; Received: 24')
  })
})

describe('summariseMeasurement', () => {
  it('returns unparseable input unchanged', () => {
    expect(summariseMeasurement('not json')).toBe('not json')
  })
})

describe('renderReport', () => {
  it('totals each status for the whole run', () => {
    const sections = orderedSections([])
    const overall = totals(sections.flatMap((section) => section.rows))

    expect(overall.notTested).toBe(overall.total)
    const html = renderReport(sections, ['abc'], 'now')
    expect(html).toContain(`Entire test: ${overall.total} requirements`)
    expect(html).toContain(
      'href="https://app.notion.com/p/41d6d73d365081dd807ff7e3623109a8"'
    )
  })
})
