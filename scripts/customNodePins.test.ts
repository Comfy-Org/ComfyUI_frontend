import { describe, expect, it } from 'vitest'

import { MAX_AGE_DAYS, ageInDays, stalest } from './customNodePins'

const at = (iso: string) => new Date(`${iso}T00:00:00Z`)

describe('ageInDays', () => {
  it('counts whole days between the pin and today', () => {
    expect(ageInDays('2026-08-01', at('2026-08-31'))).toBe(30)
  })

  it('reports null rather than 0 for an undated pin', () => {
    expect(ageInDays(undefined, at('2026-08-31'))).toBeNull()
  })

  it('reports null for a date it cannot parse', () => {
    expect(ageInDays('last tuesday', at('2026-08-31'))).toBeNull()
  })

  it('reports null for a date the calendar does not have', () => {
    expect(ageInDays('2026-02-31', at('2026-08-31'))).toBeNull()
  })
})

describe('stalest', () => {
  const dated = (pinnedAt?: string) => ({
    pack: 'p',
    repo: 'r',
    pin: 'sha',
    pinnedAt
  })

  it('is the oldest pin, not the newest, because that is what freshness is worth', () => {
    expect(
      stalest(
        [dated('2026-08-30'), dated('2026-07-01'), dated('2026-08-29')],
        at('2026-08-31')
      )
    ).toBe(61)
  })

  it('refuses to answer when any pin is undated', () => {
    expect(stalest([dated('2026-08-30'), dated()], at('2026-08-31'))).toBeNull()
  })

  it('breaches the limit one day past it, not on it', () => {
    const onLimit = stalest([dated('2026-08-01')], at('2026-08-31'))
    const pastLimit = stalest([dated('2026-08-01')], at('2026-09-01'))
    expect(onLimit).toBe(MAX_AGE_DAYS)
    expect(pastLimit).toBeGreaterThan(MAX_AGE_DAYS)
  })
})
