import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'

import { api } from '@/scripts/api'

import { createFileDownload } from './useAssetDownload'

const distribution = vi.hoisted(() => ({ isCloud: false }))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return distribution.isCloud
  }
}))

const API_ORIGIN = 'http://localhost:8188'
const CONTENT_ROUTE = '/api/assets/1/content'
const CONTENT_URL = `${API_ORIGIN}${CONTENT_ROUTE}`

function hideUrlParse() {
  const descriptor = Object.getOwnPropertyDescriptor(URL, 'parse')
  Object.defineProperty(URL, 'parse', {
    configurable: true,
    value: undefined
  })
  onTestFinished(() => {
    if (descriptor) Object.defineProperty(URL, 'parse', descriptor)
    else Reflect.deleteProperty(URL, 'parse')
  })
}

beforeEach(() => {
  distribution.isCloud = false
  api.api_base = API_ORIGIN
  vi.mocked(fetch).mockImplementation(async () => new Response())
  vi.spyOn(api, 'fetchApi').mockImplementation(async () => new Response())
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
    'fetches %s on cloud at the asset content URL',
    async (url) => {
      distribution.isCloud = true
      const download = createFileDownload(url, 'a.png')
      assert(download.mode === 'fetch')

      await download.fetch?.(url)

      expect(api.apiURL(vi.mocked(api.fetchApi).mock.calls[0][0])).toBe(
        CONTENT_URL
      )
      expect(fetch).not.toHaveBeenCalled()
    }
  )

  it.for(['https://cdn.example.com/image.png', 'blob:http://localhost:3000/1'])(
    'fetches %s on cloud without credentials',
    async (url) => {
      distribution.isCloud = true
      const download = createFileDownload(url, 'a.png')
      assert(download.mode === 'fetch')

      await download.fetch?.(url)

      expect(fetch).toHaveBeenCalledWith(url, { credentials: 'omit' })
      expect(api.fetchApi).not.toHaveBeenCalled()
    }
  )

  it('routes an API URL where the static URL.parse is missing', async () => {
    hideUrlParse()
    distribution.isCloud = true

    const download = createFileDownload(CONTENT_URL, 'a.png')
    assert(download.mode === 'fetch')
    await download.fetch?.(CONTENT_URL)

    expect(api.apiURL(vi.mocked(api.fetchApi).mock.calls[0][0])).toBe(
      CONTENT_URL
    )
  })

  it('fetches an unparseable URL directly instead of throwing', async () => {
    distribution.isCloud = true
    const download = createFileDownload('http://[', 'a.png')
    assert(download.mode === 'fetch')

    await download.fetch?.('http://[')

    expect(fetch).toHaveBeenCalledWith('http://[', { credentials: 'omit' })
  })
})
