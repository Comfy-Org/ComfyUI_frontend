import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const context: Record<string, unknown> = {}

  return {
    context,
    fetch: vi.fn<typeof fetch>(),
    getInitConfiguration: vi.fn(),
    init: vi.fn(),
    setGlobalContextProperty: vi.fn((key: string, value: unknown) => {
      context[key] = value
    })
  }
})

vi.mock('@datadog/browser-rum', () => ({
  datadogRum: hoisted
}))

import { rumBeforeSend } from './datadogRumBeforeSend'
import { initDatadogRum } from './initDatadogRum'

describe('initDatadogRum', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    for (const key of Object.keys(hoisted.context)) {
      delete hoisted.context[key]
    }
    hoisted.setGlobalContextProperty.mockImplementation((key, value) => {
      hoisted.context[key] = value
    })
    hoisted.fetch.mockResolvedValue(new Response(null, { status: 503 }))
    hoisted.getInitConfiguration.mockReturnValue(undefined)
    vi.stubGlobal('fetch', hoisted.fetch)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
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

      expect(hoisted.init).toHaveBeenCalledWith({
        clientToken: 'pub7704486e5b64eb4ff6f62891cda45559',
        applicationId: '041a9897-5516-4b1f-a245-1a9aa6895488',
        site: 'us5.datadoghq.com',
        service: 'comfy-cloud-frontend',
        env,
        version: __COMFYUI_FRONTEND_VERSION__,
        beforeSend: rumBeforeSend,
        sessionSampleRate: 100,
        sessionReplaySampleRate: 0,
        allowedTracingUrls: [expect.any(RegExp)]
      })
    }
  )

  it('tags canary traffic with its bucket and frontend version', async () => {
    let resolveProbe: (response: Response) => void
    hoisted.fetch.mockReturnValue(
      new Promise((resolve) => {
        resolveProbe = resolve
      })
    )
    hoisted.init.mockImplementation(() => {
      expect(hoisted.context).toEqual({
        bucket: 'canary',
        version: __COMFYUI_FRONTEND_COMMIT__
      })
    })

    const initialization = initDatadogRum('cloud.comfy.org')

    expect(hoisted.init).not.toHaveBeenCalled()
    resolveProbe!(
      new Response(null, {
        headers: {
          'X-Frontend-Bucket': 'canary',
          'X-Frontend-Version': __COMFYUI_FRONTEND_COMMIT__
        }
      })
    )
    await initialization

    expect(hoisted.context).toEqual({
      bucket: 'canary',
      version: __COMFYUI_FRONTEND_COMMIT__
    })
    expect(hoisted.init).toHaveBeenCalledOnce()
  })

  it('serializes concurrent initialization', async () => {
    let resolveProbe: (response: Response) => void
    hoisted.fetch.mockReturnValue(
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

    expect(hoisted.fetch).toHaveBeenCalledOnce()
    expect(hoisted.init).toHaveBeenCalledOnce()
    expect(hoisted.context).toEqual({
      bucket: 'canary',
      version: __COMFYUI_FRONTEND_COMMIT__
    })
  })

  it('defaults the bucket to stable and tracks its frontend version', async () => {
    hoisted.fetch.mockResolvedValue(
      new Response(null, {
        headers: { 'X-Frontend-Version': __COMFYUI_FRONTEND_COMMIT__ }
      })
    )

    await initDatadogRum('cloud.comfy.org')

    expect(hoisted.context).toEqual({
      bucket: 'stable',
      version: __COMFYUI_FRONTEND_COMMIT__
    })
  })

  it('leaves traffic unclassified when the frontend version is absent', async () => {
    hoisted.fetch.mockResolvedValue(
      new Response(null, {
        headers: { 'X-Frontend-Bucket': 'canary' }
      })
    )

    await initDatadogRum('cloud.comfy.org')

    expect(hoisted.context).toEqual({})
  })

  it('leaves traffic unclassified when the probe reaches another version', async () => {
    hoisted.fetch.mockResolvedValue(
      new Response(null, {
        headers: {
          'X-Frontend-Bucket': 'stable',
          'X-Frontend-Version': 'another-frontend-commit'
        }
      })
    )

    await initDatadogRum('cloud.comfy.org')

    expect(hoisted.context).toEqual({})
  })

  it('leaves traffic unclassified when the header probe fails', async () => {
    hoisted.fetch.mockResolvedValue(new Response(null, { status: 503 }))

    await initDatadogRum('cloud.comfy.org')

    expect(hoisted.context).toEqual({})
    expect(hoisted.init).toHaveBeenCalledOnce()
  })

  it('initializes RUM when the header probe rejects', async () => {
    hoisted.fetch.mockRejectedValue(new Error('network error'))

    await initDatadogRum('cloud.comfy.org')

    expect(hoisted.context).toEqual({})
    expect(hoisted.init).toHaveBeenCalledOnce()
  })

  it('initializes RUM when the header probe times out', async () => {
    const abortController = new AbortController()
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(abortController.signal)
    hoisted.fetch.mockImplementation(
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

    expect(hoisted.context).toEqual({})
    expect(hoisted.init).toHaveBeenCalledOnce()
  })

  it.for([
    'localhost',
    'testenvs.comfy.org',
    'eviltestenvs.comfy.org',
    'preview.testenvs.comfy.org.example.com'
  ])('does not initialize on unknown hostname %s', async (hostname) => {
    await initDatadogRum(hostname)

    expect(hoisted.init).not.toHaveBeenCalled()
  })

  it('does not initialize twice', async () => {
    hoisted.getInitConfiguration.mockReturnValue({})

    await initDatadogRum('cloud.comfy.org')

    expect(hoisted.init).not.toHaveBeenCalled()
  })
})
