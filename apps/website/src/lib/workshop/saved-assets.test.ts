import { describe, expect, it } from 'vitest'

import type { SavedGeneration } from '../../config/workshop-generation-assets'
import {
  accessAfterFailure,
  mergeGenerations,
  savedAssetFileName,
  savedAssetTiles
} from './saved-assets'

function generation(overrides: Partial<SavedGeneration> = {}): SavedGeneration {
  return {
    request_id: '18655193-3f73-4abf-b49c-1c6a058355bc',
    provider: 'bfl',
    model: 'flux-2-pro',
    created_at: '2026-09-20T12:00:00Z',
    status: 'COMPLETED',
    asset_save_status: 'saved',
    asset_outputs: [
      {
        index: 0,
        kind: 'image',
        status: 'saved',
        asset_id: '932cad6b-c94f-4e83-bffa-84be407b0440'
      }
    ],
    ...overrides
  }
}

describe('savedAssetTiles', () => {
  it('keeps a running generation on the strip so leaving the page does not lose it', () => {
    const running = generation({
      status: 'IN_PROGRESS',
      asset_save_status: 'pending',
      asset_outputs: []
    })

    expect(savedAssetTiles([running])).toEqual([
      { state: 'pending', key: running.request_id, generation: running }
    ])
  })

  it('drops an output the account can no longer reach rather than showing a broken tile', () => {
    const assetId = generation().asset_outputs[0].asset_id

    expect(savedAssetTiles([generation()], new Set([assetId]))).toEqual([])
  })

  it.for([
    ['pending', []],
    ['saving', []],
    ['failed', []],
    ['unavailable', []],
    ['saved', ['a']]
  ] as const)(
    'shows an output whose save status is %s as %j',
    ([status, expected]) => {
      const tiles = savedAssetTiles([
        generation({
          asset_outputs: [{ index: 0, kind: 'image', status, asset_id: 'a' }]
        })
      ])

      expect(tiles.map((tile) => tile.key)).toEqual(expected)
    }
  )

  it('caps the strip so the page stays a strip and not a library', () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      generation({
        request_id: `request-${index}`,
        created_at: `2026-09-20T12:00:${String(index).padStart(2, '0')}Z`,
        asset_outputs: [
          {
            index: 0,
            kind: 'image',
            status: 'saved',
            asset_id: `asset-${index}`
          }
        ]
      })
    )

    expect(savedAssetTiles(many)).toHaveLength(8)
  })
})

describe('mergeGenerations', () => {
  it('replaces a known generation with its newer state instead of listing it twice', () => {
    const running = generation({
      status: 'IN_PROGRESS',
      asset_save_status: 'pending',
      asset_outputs: []
    })

    expect(mergeGenerations([running], [generation()])).toEqual([generation()])
  })

  it('orders newest first so the run just finished leads the strip', () => {
    const older = generation({
      request_id: 'older',
      created_at: '2026-09-19T12:00:00Z'
    })

    expect(
      mergeGenerations([older], [generation()]).map((item) => item.request_id)
    ).toEqual([generation().request_id, 'older'])
  })
})

describe('savedAssetFileName', () => {
  it.for([
    ['https://assets.example/renders/teapot.webp', 'teapot.webp'],
    ['https://assets.example/932cad6b', 'comfy-932cad6b.png']
  ] as const)(
    'downloads %s as %s, so the file is openable and named after the work',
    ([url, expected]) => {
      expect(savedAssetFileName('932cad6b', 'image', url)).toBe(expected)
    }
  )
})

describe('accessAfterFailure', () => {
  const now = 1_000_000
  const url = 'https://assets.example/saved.png'

  it.for([
    ['nothing granted yet', undefined, undefined],
    ['a grant with time left', { url, expiresAt: now + 30_000 }, url],
    ['a grant that has lapsed', { url, expiresAt: now - 1 }, undefined]
  ] as const)(
    'serves %s as %s while it schedules the retry',
    ([, held, expected]) => {
      const next = accessAfterFailure(
        held && { ...held, renewAt: now - 1 },
        now,
        15_000
      )

      expect(
        next.url,
        'a URL still inside its expiry outlives the attempt to replace it'
      ).toBe(expected)
      expect(next.renewAt, 'nothing else would ask again').toBe(now + 15_000)
    }
  )
})
