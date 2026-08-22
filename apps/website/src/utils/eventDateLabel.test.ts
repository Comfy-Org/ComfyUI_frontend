import { describe, expect, it } from 'vitest'

import { formatEventDateLabel } from './eventDateLabel'

describe('formatEventDateLabel', () => {
  it('formats a single on-the-hour time in English', () => {
    expect(
      formatEventDateLabel(
        {
          startDateTime: '2026-08-19T10:00:00-07:00',
          timeZone: 'America/Los_Angeles'
        },
        'en'
      )
    ).toBe('August 19, 2026 · 10 AM PT')
  })

  it('shares the AM/PM suffix across a same-period range', () => {
    expect(
      formatEventDateLabel(
        {
          startDateTime: '2026-08-26T18:00:00-07:00',
          endDateTime: '2026-08-26T21:00:00-07:00',
          timeZone: 'America/Los_Angeles'
        },
        'en'
      )
    ).toBe('August 26, 2026 · 6–9 PM PT')
  })

  it('shows minutes on both endpoints when either has them', () => {
    expect(
      formatEventDateLabel(
        {
          startDateTime: '2026-09-13T14:00:00-07:00',
          endDateTime: '2026-09-13T18:30:00-07:00',
          timeZone: 'America/Los_Angeles'
        },
        'en'
      )
    ).toBe('September 13, 2026 · 2:00–6:30 PM PT')
  })

  it('spells both periods across a cross-period range', () => {
    expect(
      formatEventDateLabel(
        {
          startDateTime: '2026-08-26T10:00:00-07:00',
          endDateTime: '2026-08-26T13:00:00-07:00',
          timeZone: 'America/Los_Angeles'
        },
        'en'
      )
    ).toBe('August 26, 2026 · 10 AM–1 PM PT')
  })

  it('renders Eastern events with the ET abbreviation and minutes', () => {
    expect(
      formatEventDateLabel(
        {
          startDateTime: '2026-08-27T13:30:00-04:00',
          timeZone: 'America/New_York'
        },
        'en'
      )
    ).toBe('August 27, 2026 · 1:30 PM ET')
  })

  it('formats Chinese labels with 点 for on-the-hour times', () => {
    expect(
      formatEventDateLabel(
        {
          startDateTime: '2026-08-19T10:00:00-07:00',
          timeZone: 'America/Los_Angeles'
        },
        'zh-CN'
      )
    ).toBe('2026年8月19日 · 上午10点（PT）')
  })

  it('formats Chinese same-period ranges with 至 and a single period prefix', () => {
    expect(
      formatEventDateLabel(
        {
          startDateTime: '2026-08-26T18:00:00-07:00',
          endDateTime: '2026-08-26T21:00:00-07:00',
          timeZone: 'America/Los_Angeles'
        },
        'zh-CN'
      )
    ).toBe('2026年8月26日 · 下午6点至9点（PT）')
  })

  it('formats Chinese ranges with minutes when either endpoint has them', () => {
    expect(
      formatEventDateLabel(
        {
          startDateTime: '2026-09-13T14:00:00-07:00',
          endDateTime: '2026-09-13T18:30:00-07:00',
          timeZone: 'America/Los_Angeles'
        },
        'zh-CN'
      )
    ).toBe('2026年9月13日 · 下午2:00至6:30（PT）')
  })

  it('prefixes both Chinese periods across a cross-period range', () => {
    expect(
      formatEventDateLabel(
        {
          startDateTime: '2026-08-26T10:00:00-07:00',
          endDateTime: '2026-08-26T13:00:00-07:00',
          timeZone: 'America/Los_Angeles'
        },
        'zh-CN'
      )
    ).toBe('2026年8月26日 · 上午10点至下午1点（PT）')
  })

  it('defaults the time zone to Pacific', () => {
    expect(
      formatEventDateLabel({ startDateTime: '2026-08-05T10:00:00-07:00' }, 'en')
    ).toBe('August 5, 2026 · 10 AM PT')
  })
})
