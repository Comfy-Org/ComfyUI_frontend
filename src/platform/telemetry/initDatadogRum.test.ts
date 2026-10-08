import { datadogRum } from '@datadog/browser-rum'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn<typeof fetch>()

vi.mock(import('@datadog/browser-rum'))
vi.mock(import('./manualRefreshTracker'), () => ({
  trackUserManualRefresh: vi.fn()
}))

import { rumBeforeSend } from './datadogRumBeforeSend'
import { initDatadogRum } from './initDatadogRum'
import { trackUserManualRefresh } from './manualRefreshTracker'

describe('initDatadogRum', () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }))
    vi.mocked(datadogRum.getInitConfiguration).mockReturnValue(undefined)
    vi.stubGlobal('fetch', fetchMock)
  })

  it.for([
    { hostname: 'cloud.comfy.org', env: 'prod-v2' },
    { hostname: 'stagingcloud.comfy.org', env: 'stg-v2' },
    { hostname: 'testcloud.comfy.org', env: 'test-v2' },
    { hostname: 'fe-pr-13691.testenvs.comfy.org', env: 'test-v2' }
  ])(
    'initializes $hostname with the $env environment',
    async ({ hostname, env }) => {
      await initDatadogRum(hostname)

      expect(datadogRum.init).toHaveBeenCalledWith({
        clientToken: 'pub7704486e5b64eb4ff6f62891cda45559',
        applicationId: '041a9897-5516-4b1f-a245-1a9aa6895488',
        site: 'us5.datadoghq.com',
        service: 'comfy-cloud-frontend',
        env,
        version: __COMFYUI_FRONTEND_COMMIT__,
        beforeSend: rumBeforeSend,
        sessionSampleRate: 100,
        sessionReplaySampleRate: 0,
        trackFeatureFlagsForEvents: [
          'action',
          'vital',
          'long_task',
          'resource'
        ],
        allowedTracingUrls: [expect.any(RegExp)]
      })
    }
  )

  it('tags canary traffic with its bucket and frontend version', async () => {
    let resolveProbe: (response: Response) => void
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        resolveProbe = resolve
      })
    )
    vi.mocked(datadogRum.init).mockImplementation(() => {
      expect(datadogRum.getGlobalContext()).toEqual({
        bucket: 'canary',
        comfyui_frontend_version: __COMFYUI_FRONTEND_VERSION__,
        version: __COMFYUI_FRONTEND_COMMIT__
      })
    })

    const initialization = initDatadogRum('cloud.comfy.org')

    expect(datadogRum.init).not.toHaveBeenCalled()
    resolveProbe!(
      new Response(null, {
        headers: {
          'X-Frontend-Bucket': 'canary',
          'X-Frontend-Version': __COMFYUI_FRONTEND_COMMIT__
        }
      })
    )
    await initialization

    expect(datadogRum.getGlobalContext()).toEqual({
      bucket: 'canary',
      comfyui_frontend_version: __COMFYUI_FRONTEND_VERSION__,
      version: __COMFYUI_FRONTEND_COMMIT__
    })
    expect(datadogRum.init).toHaveBeenCalledOnce()
  })

  it('serializes concurrent initialization', async () => {
    let resolveProbe: (response: Response) => void
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        resolveProbe = resolve
      })
    )

    const firstInitialization = initDatadogRum('cloud.comfy.org')
    const secondInitialization = initDatadogRum('cloud.comfy.org')

    resolveProbe!(
      new Response(null, {
        headers: {
          'X-Frontend-Bucket': 'canary',
          'X-Frontend-Version': __COMFYUI_FRONTEND_COMMIT__
        }
      })
    )
    await Promise.all([firstInitialization, secondInitialization])

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(datadogRum.init).toHaveBeenCalledOnce()
    expect(datadogRum.getGlobalContext()).toEqual({
      bucket: 'canary',
      comfyui_frontend_version: __COMFYUI_FRONTEND_VERSION__,
      version: __COMFYUI_FRONTEND_COMMIT__
    })
  })

  it('defaults the bucket to stable and tracks its frontend version', async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        headers: { 'X-Frontend-Version': __COMFYUI_FRONTEND_COMMIT__ }
      })
    )

    await initDatadogRum('cloud.comfy.org')

    expect(datadogRum.getGlobalContext()).toEqual({
      bucket: 'stable',
      comfyui_frontend_version: __COMFYUI_FRONTEND_VERSION__,
      version: __COMFYUI_FRONTEND_COMMIT__
    })
  })

  it('leaves traffic unclassified when the frontend version is absent', async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        headers: { 'X-Frontend-Bucket': 'canary' }
      })
    )

    await initDatadogRum('cloud.comfy.org')

    expect(datadogRum.getGlobalContext()).toEqual({
      comfyui_frontend_version: __COMFYUI_FRONTEND_VERSION__
    })
  })

  it('leaves traffic unclassified when the probe reaches another version', async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        headers: {
          'X-Frontend-Bucket': 'stable',
          'X-Frontend-Version': 'another-frontend-commit'
        }
      })
    )

    await initDatadogRum('cloud.comfy.org')

    expect(datadogRum.getGlobalContext()).toEqual({
      comfyui_frontend_version: __COMFYUI_FRONTEND_VERSION__
    })
  })

  it('leaves traffic unclassified when the header probe fails', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }))

    await initDatadogRum('cloud.comfy.org')

    expect(datadogRum.getGlobalContext()).toEqual({
      comfyui_frontend_version: __COMFYUI_FRONTEND_VERSION__
    })
    expect(datadogRum.init).toHaveBeenCalledOnce()
  })

  it('initializes RUM when the header probe rejects', async () => {
    fetchMock.mockRejectedValue(new Error('network error'))

    await initDatadogRum('cloud.comfy.org')

    expect(datadogRum.getGlobalContext()).toEqual({
      comfyui_frontend_version: __COMFYUI_FRONTEND_VERSION__
    })
    expect(datadogRum.init).toHaveBeenCalledOnce()
  })

  it('initializes RUM when the header probe times out', async () => {
    const abortController = new AbortController()
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(abortController.signal)
    fetchMock.mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Timed out', 'AbortError'))
          })
        })
    )

    const initialization = initDatadogRum('cloud.comfy.org')
    abortController.abort()
    await initialization

    expect(datadogRum.getGlobalContext()).toEqual({
      comfyui_frontend_version: __COMFYUI_FRONTEND_VERSION__
    })
    expect(datadogRum.init).toHaveBeenCalledOnce()
  })

  it.for([
    'localhost',
    'testenvs.comfy.org',
    'eviltestenvs.comfy.org',
    'preview.testenvs.comfy.org.example.com'
  ])('does not initialize on unknown hostname %s', async (hostname) => {
    await initDatadogRum(hostname)

    expect(datadogRum.init).not.toHaveBeenCalled()
  })

  it('does not initialize twice', async () => {
    vi.mocked(datadogRum.getInitConfiguration).mockReturnValue({
      applicationId: 'initialized',
      clientToken: 'initialized'
    })

    await initDatadogRum('cloud.comfy.org')

    expect(datadogRum.init).not.toHaveBeenCalled()
  })

  it('tracks manual refreshes only once RUM is initialized', async () => {
    await initDatadogRum('localhost')

    expect(vi.mocked(trackUserManualRefresh)).not.toHaveBeenCalled()

    await initDatadogRum('cloud.comfy.org')

    expect(vi.mocked(trackUserManualRefresh)).toHaveBeenCalledOnce()
  })
})
