import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'
import { fetchVideoMetadata } from '@/utils/videoMetadataUtil'

vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: vi.fn(),
    apiURL: (path: string) => `http://localhost:8188/api${path}`
  }
}))

const metadata = {
  fps: 30,
  duration: 4.2,
  frame_count: 126,
  width: 1920,
  height: 1080,
  size: 1024
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

  it('queries the backend with the view resource params', async () => {
    mockResponse(true, metadata)

    const result = await fetchVideoMetadata(
      'http://localhost:8188/api/view?filename=a.mp4&subfolder=clips&type=input&rand=0.1'
    )

    expect(api.fetchApi).toHaveBeenCalledWith(
      '/video_metadata?filename=a.mp4&subfolder=clips&type=input'
    )
    expect(result).toEqual(metadata)
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

  it('returns undefined when the backend lacks the endpoint', async () => {
    mockResponse(false)

    const result = await fetchVideoMetadata('/api/view?filename=a.mp4')

    expect(result).toBeUndefined()
  })

  it('returns undefined for malformed responses', async () => {
    mockResponse(true, { unexpected: true })

    const result = await fetchVideoMetadata('/api/view?filename=a.mp4')

    expect(result).toBeUndefined()
  })
})
