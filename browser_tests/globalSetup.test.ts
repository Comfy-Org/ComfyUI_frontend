import { describe, expect, it, vi } from 'vitest'

import { runGlobalSetup } from '@e2e/globalSetup'

function response(status: number): Response {
  return new Response(null, { status })
}

describe('browser test global setup', () => {
  it.for([
    { name: 'missing route', status: 404 },
    { name: 'method mismatch', status: 405 }
  ])('rejects a $name response (HTTP $status)', async ({ status }) => {
    const fetchRequest = vi.fn<typeof fetch>(() =>
      Promise.resolve(response(status))
    )

    await expect(
      runGlobalSetup({
        env: { CI: '1' },
        fetch: fetchRequest,
        backup: vi.fn()
      })
    ).rejects.toThrow('ComfyUI_devtools is not loaded')
    expect(fetchRequest).toHaveBeenCalledWith(
      'http://localhost:8188/api/devtools/fake_model.safetensors',
      expect.objectContaining({
        method: 'GET',
        signal: expect.any(AbortSignal)
      })
    )
  })

  it.for([
    { name: 'healthy route', result: () => Promise.resolve(response(200)) },
    {
      name: 'inconclusive response',
      result: () => Promise.resolve(response(503))
    },
    {
      name: 'network failure',
      result: () => Promise.reject(new TypeError('network unavailable'))
    },
    {
      name: 'timeout',
      result: () => Promise.reject(new DOMException('timed out', 'AbortError'))
    }
  ])('leaves a $name to its owning fixture', async ({ result }) => {
    const fetchRequest = vi.fn<typeof fetch>(result)

    await expect(
      runGlobalSetup({
        env: { CI: '1' },
        fetch: fetchRequest,
        backup: vi.fn()
      })
    ).resolves.toBeUndefined()
  })

  it.for([
    {
      name: 'remote browser URL',
      env: { CI: '1', PLAYWRIGHT_TEST_URL: 'https://testcloud.comfy.org' }
    },
    {
      name: 'local Vite proxy to a remote backend',
      env: {
        CI: '1',
        PLAYWRIGHT_TEST_URL: 'http://localhost:5173',
        DEV_SERVER_COMFYUI_URL: 'https://testcloud.comfy.org'
      }
    }
  ])('skips the probe for $name', async ({ env }) => {
    const fetchRequest = vi.fn<typeof fetch>()

    await runGlobalSetup({ env, fetch: fetchRequest, backup: vi.fn() })

    expect(fetchRequest).not.toHaveBeenCalled()
  })

  it('honors an explicit local setup API despite a remote Vite backend', async () => {
    const fetchRequest = vi.fn<typeof fetch>(() =>
      Promise.resolve(response(200))
    )

    await runGlobalSetup({
      env: {
        CI: '1',
        PLAYWRIGHT_SETUP_API_URL: 'http://127.0.0.1:8188',
        PLAYWRIGHT_TEST_URL: 'http://localhost:5173',
        DEV_SERVER_COMFYUI_URL: 'https://testcloud.comfy.org'
      },
      fetch: fetchRequest,
      backup: vi.fn()
    })

    expect(fetchRequest).toHaveBeenCalledWith(
      'http://127.0.0.1:8188/api/devtools/fake_model.safetensors',
      expect.any(Object)
    )
  })

  it('does not mutate backups when the preflight fails', async () => {
    const backup = vi.fn()

    await expect(
      runGlobalSetup({
        env: { TEST_COMFYUI_DIR: '/tmp/comfyui' },
        fetch: vi.fn<typeof fetch>(() => Promise.resolve(response(404))),
        backup
      })
    ).rejects.toThrow('ComfyUI_devtools is not loaded')
    expect(backup).not.toHaveBeenCalled()
  })
})
