import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchEnvInfo } from './envInfo'

describe('fetchEnvInfo', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns cloud environment versions from system stats', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          system: {
            cloud_version: 'e299178',
            comfyui_version: 'abc1234',
            deploy_environment: 'test'
          }
        })
      )
    )

    await expect(fetchEnvInfo('https://testcloud.comfy.org/')).resolves.toEqual(
      {
        ok: true,
        cloudVersion: 'e299178',
        comfyuiVersion: 'abc1234',
        deployEnvironment: 'test'
      }
    )
  })

  it.for([
    { label: 'HTTP failure', response: new Response('', { status: 503 }) },
    { label: 'invalid payload', response: new Response('{}') }
  ])('returns failure for $label', async ({ response }) => {
    vi.mocked(fetch).mockResolvedValue(response)
    await expect(fetchEnvInfo('https://example.com/')).resolves.toEqual({
      ok: false
    })
  })

  it('aborts a request that exceeds the timeout', async () => {
    vi.mocked(fetch).mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          )
        })
    )

    await expect(fetchEnvInfo('https://example.com/', 1)).resolves.toEqual({
      ok: false
    })
  })
})
