// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => ({
  sdkImported: vi.fn(),
  mockIdentify: vi.fn(async () => undefined),
  mockTrack: vi.fn(async () => undefined),
  mockLoad: vi.fn(() =>
    Promise.resolve([
      { identify: hoisted.mockIdentify, track: hoisted.mockTrack },
      {}
    ])
  )
}))

vi.mock('@customerio/cdp-analytics-browser', () => {
  hoisted.sdkImported()
  // AnalyticsBrowser.load returns a thenable resolving to [Analytics, Context]
  return {
    AnalyticsBrowser: {
      load: hoisted.mockLoad
    }
  }
})

async function importModule(writeKey: string) {
  vi.stubEnv('PUBLIC_CUSTOMERIO_WRITE_KEY', writeKey)
  return import('./customerio')
}

describe('customerio', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('is disabled and never loads the SDK when the write key is empty', async () => {
    const { isDownloadLinkRequestEnabled, preloadDownloadLinkAnalytics } =
      await importModule('')

    expect(isDownloadLinkRequestEnabled).toBe(false)
    preloadDownloadLinkAnalytics()

    expect(hoisted.sdkImported).not.toHaveBeenCalled()
    expect(hoisted.mockIdentify).not.toHaveBeenCalled()
    expect(hoisted.mockTrack).not.toHaveBeenCalled()
  })

  it('identifies by email then tracks download_link_requested with locale and page', async () => {
    const { isDownloadLinkRequestEnabled, requestDownloadLink } =
      await importModule('test-key')

    expect(isDownloadLinkRequestEnabled).toBe(true)
    await requestDownloadLink('someone@example.com', 'zh-CN')

    expect(hoisted.mockLoad).toHaveBeenCalledWith({ writeKey: 'test-key' })
    expect(hoisted.mockIdentify).toHaveBeenCalledWith('someone@example.com', {
      email: 'someone@example.com'
    })
    expect(hoisted.mockTrack).toHaveBeenCalledWith('download_link_requested', {
      locale: 'zh-CN',
      page: window.location.pathname
    })
    expect(hoisted.mockIdentify.mock.invocationCallOrder[0]).toBeLessThan(
      hoisted.mockTrack.mock.invocationCallOrder[0]
    )
  })

  it('retries the SDK load on the next submit instead of caching a failed load', async () => {
    const { preloadDownloadLinkAnalytics, requestDownloadLink } =
      await importModule('test-key')

    hoisted.mockLoad.mockRejectedValueOnce(new Error('offline'))
    preloadDownloadLinkAnalytics()
    await expect(requestDownloadLink('a@example.com', 'en')).rejects.toThrow(
      'offline'
    )

    await requestDownloadLink('a@example.com', 'en')

    expect(hoisted.mockLoad).toHaveBeenCalledTimes(2)
    expect(hoisted.mockTrack).toHaveBeenCalledTimes(1)
  })

  it('loads the SDK once across preload and repeated submits', async () => {
    const { preloadDownloadLinkAnalytics, requestDownloadLink } =
      await importModule('test-key')

    preloadDownloadLinkAnalytics()
    await requestDownloadLink('a@example.com', 'en')
    await requestDownloadLink('b@example.com', 'en')

    expect(hoisted.mockLoad).toHaveBeenCalledTimes(1)
    expect(hoisted.mockTrack).toHaveBeenCalledTimes(2)
  })
})
