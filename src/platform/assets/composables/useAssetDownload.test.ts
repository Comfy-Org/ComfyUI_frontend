import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createFileDownload } from './useAssetDownload'

const distribution = vi.hoisted(() => ({ isCloud: false }))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return distribution.isCloud
  }
}))

describe('createFileDownload', () => {
  beforeEach(() => {
    distribution.isCloud = false
  })

  it('downloads directly when not on cloud', () => {
    expect(createFileDownload('/api/assets/1/content', 'a.png')).toEqual({
      mode: 'direct',
      url: '/api/assets/1/content',
      filename: 'a.png'
    })
  })

  it('fetches cloud downloads through the app fetch rather than the global one', () => {
    distribution.isCloud = true
    const download = createFileDownload('/api/assets/1/content', 'a.png')
    if (download.mode !== 'fetch') throw new Error('expected a fetch download')

    expect(download.fetch).toBeTypeOf('function')
    expect(download.fetch).not.toBe(globalThis.fetch)
  })
})
