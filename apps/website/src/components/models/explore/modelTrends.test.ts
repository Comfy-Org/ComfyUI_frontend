import { describe, expect, it } from 'vitest'

import { rankModelTrends, trendModelVersions } from './modelTrends'
import type { z } from 'zod'
import type { modelTrendSnapshotSchema } from './modelTrends'

const now = new Date('2026-10-01T12:00:00Z')
const snapshot = {
  asOf: '2026-10-01T00:00:00Z',
  source: 'comfy-cloud-partner-successes',
  rows: [
    {
      model: 'seedream-5-0-pro-260628',
      usersCurrent: 100,
      usersPrevious: 80,
      runsCurrent: 90000
    },
    {
      model: 'gemini-3-pro-image',
      usersCurrent: 70,
      usersPrevious: 20,
      runsCurrent: 100
    },
    {
      model: 'dreamina-seedance-2-5-260628',
      usersCurrent: 80,
      usersPrevious: 90,
      runsCurrent: 10000
    },
    {
      model: 'hy-image-v3.5-preview',
      usersCurrent: 1,
      usersPrevious: 0,
      runsCurrent: 900000
    },
    {
      model: 'unverified-family',
      usersCurrent: 900,
      usersPrevious: 0,
      runsCurrent: 10000
    }
  ]
} satisfies z.infer<typeof modelTrendSnapshotSchema>

describe('model usage trends', () => {
  it('excludes versions without a Comfy model page before ranking', () => {
    const rows = trendModelVersions.map((model, index) => ({
      model: model.id,
      usersCurrent: 100 + index,
      usersPrevious: 10,
      runsCurrent: 1000
    }))
    const ranked = rankModelTrends({ ...snapshot, rows }, now)
    expect(ranked).toHaveLength(8)
    expect(ranked.every((model) => model.href.startsWith('/'))).toBe(true)
    expect(ranked[0]?.id).toBe(trendModelVersions.at(-1)?.id)
    expect(ranked.some((model) => model.id === trendModelVersions[0].id)).toBe(
      false
    )
  })
  it('ranks individual versions by user growth rather than generation volume', () => {
    expect(
      rankModelTrends(snapshot, now).map(({ name, growthPercent }) => ({
        name,
        growthPercent
      }))
    ).toEqual([
      { name: 'Gemini 3 Pro Image', growthPercent: 250 },
      { name: 'Seedream 5.0 Pro', growthPercent: 25 }
    ])
  })

  it('shows new activity without inventing percentage growth from zero', () => {
    const [trend] = rankModelTrends(
      {
        ...snapshot,
        rows: [
          {
            model: 'seedream-5-0-pro-260628',
            usersCurrent: 145,
            usersPrevious: 0,
            runsCurrent: 2317
          }
        ]
      },
      now
    )
    expect(trend).toMatchObject({
      name: 'Seedream 5.0 Pro',
      growthPercent: null
    })
  })

  it.for(['2026-09-23T00:00:00Z', '2026-10-02T00:00:00Z'])(
    'does not present stale or future data as current (%s)',
    (asOf) => expect(rankModelTrends({ ...snapshot, asOf }, now)).toEqual([])
  )
})
