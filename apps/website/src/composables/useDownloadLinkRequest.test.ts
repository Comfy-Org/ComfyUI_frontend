// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => ({
  sdkImported: vi.fn(),
  mockIdentify: vi.fn().mockResolvedValue(undefined),
  mockTrack: vi.fn().mockResolvedValue(undefined),
  mockLoad: vi.fn()
}))

vi.mock('@customerio/cdp-analytics-browser', () => {
  hoisted.sdkImported()
  // AnalyticsBrowser.load returns a thenable resolving to [Analytics, Context]
  return {
    AnalyticsBrowser: {
      load: hoisted.mockLoad.mockReturnValue(
        Promise.resolve([
          { identify: hoisted.mockIdentify, track: hoisted.mockTrack },
          {}
        ])
      )
    }
  }
})

async function importComposable(writeKey: string) {
  vi.stubEnv('PUBLIC_CUSTOMERIO_WRITE_KEY', writeKey)
  return import('./useDownloadLinkRequest')
}

describe('useDownloadLinkRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  it('is disabled and never loads the SDK when the write key is empty', async () => {
    const { useDownloadLinkRequest } = await importComposable('')
    const { isEnabled, preload, submit } = useDownloadLinkRequest('en')

    expect(isEnabled).toBe(false)
    preload()
    await submit('someone@example.com')

    expect(hoisted.sdkImported).not.toHaveBeenCalled()
    expect(hoisted.mockIdentify).not.toHaveBeenCalled()
    expect(hoisted.mockTrack).not.toHaveBeenCalled()
  })

  it('identifies by email then tracks download_link_requested with locale and page', async () => {
    const { useDownloadLinkRequest } = await importComposable('test-key')
    const { isEnabled, submit } = useDownloadLinkRequest('zh-CN')

    expect(isEnabled).toBe(true)
    await submit('someone@example.com')

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

  it('loads the SDK once across preload and repeated submits', async () => {
    const { useDownloadLinkRequest } = await importComposable('test-key')
    const { preload, submit } = useDownloadLinkRequest('en')

    preload()
    await submit('a@example.com')
    await submit('b@example.com')

    expect(hoisted.mockLoad).toHaveBeenCalledTimes(1)
    expect(hoisted.mockTrack).toHaveBeenCalledTimes(2)
  })
})
