import { describe, expect, it } from 'vitest'

import {
  compareLines,
  groupByPr,
  labelPath,
  oldestLine,
  parseLine,
  parseTargetLabel,
  planRetirement,
  reportLine,
  retirementComment
} from './retire-backport-labels'

const LABELS = [
  'needs-backport',
  'backport',
  'cloud/1.52',
  'cloud/1.53',
  'cloud/1.54',
  'cloud/1.55',
  'cloud/1.56',
  'cloud/1.57',
  'core/1.52',
  'core/1.53',
  'core/1.54',
  'core/1.55',
  'core/1.56',
  'core/1.57',
  'released:cloud',
  'retired/cloud/1.40'
]

describe('parseTargetLabel', () => {
  it('reads core and cloud target labels', () => {
    expect(parseTargetLabel('cloud/1.55')).toEqual({
      product: 'cloud',
      line: { major: 1, minor: 55 }
    })
    expect(parseTargetLabel('core/2.0')).toEqual({
      product: 'core',
      line: { major: 2, minor: 0 }
    })
  })

  it('ignores every other label, including look-alikes', () => {
    for (const name of [
      'needs-backport',
      'released:cloud',
      'retired/cloud/1.40',
      'cloud/1.55.1',
      'core/1',
      'branch:core/1.55',
      '1.55'
    ]) {
      expect(parseTargetLabel(name)).toBeNull()
    }
  })
})

describe('compareLines', () => {
  it('orders by minor numerically, not as text', () => {
    expect(compareLines(parseLine('1.9')!, parseLine('1.10')!)).toBeLessThan(0)
    expect(compareLines(parseLine('2.0')!, parseLine('1.99')!)).toBeGreaterThan(
      0
    )
  })
})

describe('oldestLine', () => {
  it('keeps the oldest line when a SHA is on more than one branch', () => {
    // A fork-point commit is on the cut line and every later one.
    expect(oldestLine([parseLine('1.58')!, parseLine('1.57')!])).toEqual(
      parseLine('1.57')
    )
  })

  it('returns null when there is nothing to read', () => {
    expect(oldestLine([])).toBeNull()
  })
})

describe('planRetirement', () => {
  it('retires cloud lines older than the stable line, oldest first', () => {
    expect(
      planRetirement({
        labels: LABELS,
        product: 'cloud',
        keepFrom: parseLine('1.56')!
      }).retire
    ).toEqual(['cloud/1.52', 'cloud/1.53', 'cloud/1.54', 'cloud/1.55'])
  })

  it('treats core and cloud independently', () => {
    expect(
      planRetirement({
        labels: LABELS,
        product: 'core',
        keepFrom: parseLine('1.55')!
      }).retire
    ).toEqual(['core/1.52', 'core/1.53', 'core/1.54'])
  })

  it('retires nothing when the live line is the oldest label', () => {
    expect(
      planRetirement({
        labels: LABELS,
        product: 'core',
        keepFrom: parseLine('1.52')!
      }).retire
    ).toEqual([])
  })

  it('keeps the live line itself and every newer line', () => {
    const { retire } = planRetirement({
      labels: LABELS,
      product: 'cloud',
      keepFrom: parseLine('1.57')!
    })
    expect(retire).not.toContain('cloud/1.57')
    expect(retire).toHaveLength(5)
  })

  it('refuses to act when the live line is past every label', () => {
    // A bad signal or branch mapping must not delete every label.
    expect(() =>
      planRetirement({
        labels: LABELS,
        product: 'cloud',
        keepFrom: parseLine('1.60')!
      })
    ).toThrow(/refusing/)
  })
})

describe('retirementComment', () => {
  it('names the retired label and the line to retarget to', () => {
    const body = retirementComment(['cloud/1.55'], 'cloud', '1.56')
    expect(body).toContain('`cloud/1.55` no longer ships')
    expect(body).toContain('cloud/1.56 or newer')
  })

  it('lists every retired label in one comment', () => {
    const body = retirementComment(['core/1.52', 'core/1.53'], 'core', '1.55')
    expect(body).toContain('`core/1.52`, `core/1.53` no longer ship')
  })
})

describe('groupByPr', () => {
  it('gives each PR one entry holding all of its retired labels', () => {
    const a = { number: 15602 }
    const b = { number: 16121 }
    expect(
      groupByPr([
        { label: 'cloud/1.52', pr: a },
        { label: 'cloud/1.52', pr: b },
        { label: 'cloud/1.53', pr: a }
      ])
    ).toEqual([
      { pr: a, labels: ['cloud/1.52', 'cloud/1.53'] },
      { pr: b, labels: ['cloud/1.52'] }
    ])
  })
})

describe('labelPath', () => {
  it('encodes the slash for the labels REST endpoint', () => {
    expect(labelPath('cloud/1.55')).toBe('cloud%2F1.55')
  })
})

describe('reportLine', () => {
  const pr = (n: number) => ({
    number: n,
    title: `PR ${n}`,
    html_url: `https://github.com/o/r/pull/${n}`
  })

  it('reports a bare deletion', () => {
    expect(
      reportLine({ label: 'cloud/1.52', waiting: [], open: [] }, false)
    ).toBe('• Deleted `cloud/1.52`')
  })

  it('says what a dry run would do, with PR links', () => {
    expect(
      reportLine(
        { label: 'cloud/1.54', waiting: [pr(18949)], open: [pr(19300)] },
        true
      )
    ).toBe(
      '• Would delete `cloud/1.54`; would comment on <https://github.com/o/r/pull/18949|#18949>; still open against the branch: <https://github.com/o/r/pull/19300|#19300>'
    )
  })
})
