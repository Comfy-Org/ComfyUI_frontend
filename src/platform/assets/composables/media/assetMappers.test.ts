import { describe, expect, it, vi } from 'vitest'

import { mapInputFileToAssetItem } from './assetMappers'

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

  it.each([
    ['photo.png [input]', 'photo.png'],
    ['photo.png [output]', 'photo.png'],
    ['photo.png [temp]', 'photo.png'],
    ['clip.mp4[input]', 'clip.mp4'],
    ['MyFile.WEBP [Input]', 'MyFile.WEBP']
  ])('strips ComfyUI directory annotation: %s -> %s', (input, expectedName) => {
    const asset = mapInputFileToAssetItem(input, 1, 'input')

    expect(asset.name).toBe(expectedName)
    expect(asset.id).toBe(`input-1-${expectedName}`)
    expect(asset.preview_url).toBe(
      `/api/view?filename=${encodeURIComponent(expectedName)}&type=input`
    )
  })

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
