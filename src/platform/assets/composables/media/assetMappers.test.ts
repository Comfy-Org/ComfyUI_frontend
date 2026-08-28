import { describe, expect, it, vi } from 'vitest'

import type { AssetItem } from '../../schemas/assetSchema'
import {
  getOutputGroupAssets,
  mapInputFileToAssetItem,
  unflattenOutputAssets
} from './assetMappers'

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: (path: string) => `/api${path}`
  }
}))

vi.mock('@/platform/distribution/cloudPreviewUtil', () => ({
  appendCloudResParam: vi.fn()
}))

describe('mapInputFileToAssetItem', () => {
  it('preserves a clean filename', () => {
    const asset = mapInputFileToAssetItem('photo.png', 0, 'input')

    expect(asset.name).toBe('photo.png')
    expect(asset.id).toBe('input-0-photo.png')
    expect(asset.preview_url).toBe('/api/view?filename=photo.png&type=input')
  })

  it.for([
    ['photo.png [input]', 'photo.png'],
    ['photo.png [output]', 'photo.png'],
    ['photo.png [temp]', 'photo.png'],
    ['clip.mp4[input]', 'clip.mp4'],
    ['MyFile.WEBP [Input]', 'MyFile.WEBP']
  ])(
    'strips ComfyUI directory annotation: %s -> %s',
    ([input, expectedName]) => {
      const asset = mapInputFileToAssetItem(input, 1, 'input')

      expect(asset.name).toBe(expectedName)
      expect(asset.id).toBe(`input-1-${expectedName}`)
      expect(asset.preview_url).toBe(
        `/api/view?filename=${encodeURIComponent(expectedName)}&type=input`
      )
    }
  )

  it('leaves non-annotation brackets in the filename intact', () => {
    const asset = mapInputFileToAssetItem('my [draft] image.png', 0, 'input')

    expect(asset.name).toBe('my [draft] image.png')
  })

  it('uses the directory passed in for the type query param', () => {
    const asset = mapInputFileToAssetItem('clip.mp4 [output]', 0, 'output')

    expect(asset.preview_url).toBe('/api/view?filename=clip.mp4&type=output')
    expect(asset.tags).toEqual(['output'])
  })
})

describe('unflattenOutputAssets', () => {
  const asset = (id: string, name: string, created_at: string): AssetItem => ({
    id,
    job_id: 'job-1',
    name,
    size: 1,
    created_at,
    updated_at: created_at,
    tags: ['output'],
    preview_url: `/${name}`,
    user_metadata: { nodeId: id, subfolder: 'outputs' }
  })

  it('keeps the representative asset id and exposes plain child assets', () => {
    const first = {
      ...asset('asset-1', 'first.png', '2026-01-01T00:00:00Z'),
      user_metadata: { jobId: 'stale-job' }
    }
    const second = asset('asset-2', 'second.png', '2026-01-02T00:00:00Z')

    const [group] = unflattenOutputAssets([first, second])

    expect(group.id).toBe('asset-2')
    expect(group.user_metadata?.jobId).toBe('job-1')
    expect(group.user_metadata?.outputCount).toBe(2)
    expect(group.user_metadata?.allOutputs).toBeUndefined()
    expect(getOutputGroupAssets(group)).toEqual([first, second])
  })

  it('falls back to the newest child and preserves ungrouped ordering', () => {
    const first = asset('asset-1', 'first.txt', '2026-01-01T00:00:00Z')
    const second = asset('asset-2', 'second.txt', '2026-01-02T00:00:00Z')
    const ungrouped = {
      ...asset('ungrouped', 'latest.txt', '2026-01-03T00:00:00Z'),
      job_id: undefined
    }

    const result = unflattenOutputAssets([first, ungrouped, second])

    expect(result[0]).toBe(ungrouped)
    expect(result[1].id).toBe('asset-2')
    expect(getOutputGroupAssets(result[1])).toEqual([first, second])
  })
})
