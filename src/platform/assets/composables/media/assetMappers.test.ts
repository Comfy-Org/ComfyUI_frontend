import { describe, expect, it, vi } from 'vitest'

import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

import { mapInputFileToAssetItem, unflattenOutputAssets } from './assetMappers'

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: (path: string) => `/api${path}`,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    getServerFeature: vi.fn(() => false)
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
  it('preserves each output directory type', () => {
    const asset = {
      job_id: 'job-id',
      size: 1,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    }
    const assets = [
      {
        ...asset,
        id: 'temp-id',
        name: 'preview.png',
        tags: ['temp']
      },
      {
        ...asset,
        id: 'output-id',
        name: 'saved.png',
        created_at: '2026-01-01T00:00:01Z',
        updated_at: '2026-01-01T00:00:01Z',
        tags: ['output']
      }
    ] satisfies AssetItem[]

    const [grouped] = unflattenOutputAssets(assets)
    const metadata = getOutputAssetMetadata(grouped.user_metadata)

    expect(metadata?.allOutputs?.map((output) => output.type)).toEqual([
      'temp',
      'output'
    ])
  })
})
