import { describe, expect, it } from 'vitest'
import { describeRange, satisfies } from './engines'

describe('satisfies', () => {
  it('accepts a version inside a bounded range', () => {
    expect(satisfies('v25.9.0', '>=25 <26')).toBe(true)
  })

  it('rejects a version below the lower bound', () => {
    expect(satisfies('v24.15.0', '>=25 <26')).toBe(false)
  })

  it('rejects a version at or above the upper bound', () => {
    expect(satisfies('v26.0.0', '>=25 <26')).toBe(false)
  })

  it('compares minor versions, not just majors', () => {
    expect(satisfies('11.2.0', '>=11.3')).toBe(false)
    expect(satisfies('11.13.1', '>=11.3')).toBe(true)
  })

  it('ignores prerelease suffixes', () => {
    expect(satisfies('v25.0.0-nightly', '>=25 <26')).toBe(true)
  })

  it('defers rather than guessing on ranges it cannot parse', () => {
    expect(satisfies('v24.0.0', '^25.0.0 || ~26')).toBe(true)
  })
})

describe('describeRange', () => {
  it('renders a bounded major range', () => {
    expect(describeRange('>=25 <26')).toBe('v25.x')
  })

  it('renders an open-ended minimum', () => {
    expect(describeRange('>=11.3')).toBe('v11 or newer')
  })
})
