import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import { createFileDownload } from './useAssetDownload'

const distribution = vi.hoisted(() => ({ isCloud: false }))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return distribution.isCloud
  }
}))

vi.mock(import('@/scripts/api'))

const CONTENT_ROUTE = '/api/assets/1/content'
const CONTENT_URL = 'http://localhost:8188/api/assets/1/content'

beforeEach(() => {
  distribution.isCloud = false
  vi.mocked(api.fetchApi).mockImplementation(async () => new Response())
  vi.mocked(api.apiURL).mockImplementation(
    (path) => `http://localhost:8188/api${path}`
  )
  vi.mocked(fetch).mockReset()
  vi.mocked(fetch).mockImplementation(async () => new Response())
})

describe('createFileDownload', () => {
  it('downloads directly when not on cloud', () => {
    expect(createFileDownload(CONTENT_ROUTE, 'a.png')).toEqual({
      mode: 'direct',
      url: CONTENT_ROUTE,
      filename: 'a.png'
    })
  })

  it.for([CONTENT_ROUTE, CONTENT_URL])(
    'fetches %s on cloud through the app authorization',
    async (url) => {
      distribution.isCloud = true
      const download = createFileDownload(url, 'a.png')
      if (download.mode !== 'fetch')
        throw new Error('expected a fetch download')

      await download.fetch?.(url)

      expect(api.fetchApi).toHaveBeenCalledWith(url)
      expect(fetch).not.toHaveBeenCalled()
    }
  )

  it.for(['https://cdn.example.com/image.png', 'blob:http://localhost:3000/1'])(
    'fetches %s on cloud without credentials',
    async (url) => {
      distribution.isCloud = true
      const download = createFileDownload(url, 'a.png')
      if (download.mode !== 'fetch')
        throw new Error('expected a fetch download')

      await download.fetch?.(url)

      expect(fetch).toHaveBeenCalledWith(url, { credentials: 'omit' })
      expect(api.fetchApi).not.toHaveBeenCalled()
    }
  )
})
