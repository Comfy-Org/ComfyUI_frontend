import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'
import { fetchVideoMetadata } from '@/utils/videoMetadataUtil'

vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: vi.fn(),
    apiURL: (path: string) => `http://localhost:8188/api${path}`
  }
}))

const videoAsset = {
  id: 'asset-1',
  name: 'a.mp4',
  size: 2048,
  metadata: {
    kind: 'video',
    width: 1280,
    height: 720,
    duration: 2.5,
    fps: 24,
    frame_count: 60
  }
}

function mockResponse(ok: boolean, body?: unknown) {
  vi.mocked(api.fetchApi).mockResolvedValueOnce({
    ok,
    json: async () => body
  } as Response)
}

describe('fetchVideoMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves metadata from the matching asset record', async () => {
    mockResponse(true, { assets: [videoAsset] })

    const result = await fetchVideoMetadata(
      'http://localhost:8188/api/view?filename=a.mp4&subfolder=clips&type=input&rand=0.1'
    )

    expect(api.fetchApi).toHaveBeenCalledWith(
      '/assets?include_tags=input%2Cclips&name_contains=a.mp4&limit=100'
    )
    expect(result).toEqual({
      fps: 24,
      duration: 2.5,
      frame_count: 60,
      width: 1280,
      height: 720,
      size: 2048
    })
  })

  it('defaults the tag filter to input when the url has no type', async () => {
    mockResponse(true, { assets: [videoAsset] })

    await fetchVideoMetadata('/api/view?filename=a.mp4')

    expect(api.fetchApi).toHaveBeenCalledWith(
      '/assets?include_tags=input&name_contains=a.mp4&limit=100'
    )
  })

  it('ignores assets whose name does not match exactly', async () => {
    mockResponse(true, { assets: [{ ...videoAsset, name: 'not-a.mp4' }] })

    const result = await fetchVideoMetadata(
      '/api/view?filename=a.mp4&type=input'
    )

    expect(result).toBeUndefined()
  })

  it('still returns the file size when the asset lacks video metadata', async () => {
    mockResponse(true, {
      assets: [
        {
          id: 'asset-1',
          name: 'a.mp4',
          size: 4096,
          metadata: { kind: 'image' }
        }
      ]
    })

    const result = await fetchVideoMetadata(
      '/api/view?filename=a.mp4&type=input'
    )

    expect(result).toEqual({
      fps: null,
      duration: null,
      frame_count: null,
      width: null,
      height: null,
      size: 4096
    })
  })

  it('returns undefined when the assets API is unavailable', async () => {
    mockResponse(false)

    const result = await fetchVideoMetadata('/api/view?filename=a.mp4')

    expect(result).toBeUndefined()
  })

  it('returns undefined for malformed responses', async () => {
    mockResponse(true, { unexpected: true })

    const result = await fetchVideoMetadata('/api/view?filename=a.mp4')

    expect(result).toBeUndefined()
  })

  it('returns undefined for non-view urls without fetching', async () => {
    const result = await fetchVideoMetadata('blob:abc')

    expect(api.fetchApi).not.toHaveBeenCalled()
    expect(result).toBeUndefined()
  })

  it('rejects view urls from untrusted origins without fetching', async () => {
    const result = await fetchVideoMetadata(
      'https://attacker.invalid/view?filename=a.mp4'
    )

    expect(api.fetchApi).not.toHaveBeenCalled()
    expect(result).toBeUndefined()
  })
})
