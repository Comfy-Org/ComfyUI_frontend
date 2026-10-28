import { describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'
import type { ComfyApi } from '@/scripts/api'

import { createModelsApi } from './modelsHandle'
import type { ModelFolder } from './modelsHandle'

vi.mock(import('@/scripts/api'), async () => {
  const { fromPartial } = await import('@total-typescript/shoehorn')
  return { api: fromPartial<ComfyApi>({ fetchApi: vi.fn() }) }
})

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status })
}

describe('named model catalogue', () => {
  it.for<ModelFolder>([
    'checkpoints',
    'clip',
    'clip_vision',
    'controlnet',
    'diffusion_models',
    'embeddings',
    'loras',
    'text_encoders',
    'unet',
    'upscale_models',
    'vae',
    'ipadapter',
    'vae_approx'
  ])(
    'lists logical names in %s without returning library metadata',
    async (folder) => {
      vi.mocked(api.fetchApi).mockResolvedValue(
        response([
          { name: 'a.safetensors', pathIndex: 0, absolutePath: '/private/a' },
          { name: 'sub\\b.safetensors', pathIndex: 1 },
          { name: 'a.safetensors', pathIndex: 2 }
        ])
      )
      await expect(createModelsApi().list(folder)).resolves.toEqual([
        'a.safetensors',
        'sub\\b.safetensors'
      ])
      expect(api.fetchApi).toHaveBeenCalledExactlyOnceWith(
        `/experiment/models/${folder}`,
        { method: 'GET', cache: 'no-store' }
      )
    }
  )

  it.for([
    '../userdata',
    '/models/loras',
    'loras?x=1',
    'loras%2f..',
    'custom_nodes',
    'LORAS',
    '',
    null,
    1,
    {}
  ])('refuses an untrusted folder before making a request', async (folder) => {
    const models = createModelsApi()
    await expect(Reflect.apply(models.list, models, [folder])).rejects.toThrow(
      /Unknown model folder/
    )
    expect(api.fetchApi).not.toHaveBeenCalled()
  })

  it('falls back to plain model names only after a library 404', async () => {
    vi.mocked(api.fetchApi)
      .mockResolvedValueOnce(response(null, 404))
      .mockResolvedValueOnce(
        response(['plain.safetensors', 'plain.safetensors'])
      )
    await expect(createModelsApi().list('loras')).resolves.toEqual([
      'plain.safetensors'
    ])
    expect(vi.mocked(api.fetchApi).mock.calls.map(([path]) => path)).toEqual([
      '/experiment/models/loras',
      '/models/loras'
    ])
  })

  it.for([401, 403, 500])(
    'does not fall back after HTTP %s',
    async (status) => {
      vi.mocked(api.fetchApi).mockResolvedValue(response(null, status))
      await expect(createModelsApi().list('loras')).rejects.toThrow(
        `HTTP ${status}`
      )
      expect(api.fetchApi).toHaveBeenCalledTimes(1)
    }
  )

  it.for([
    {},
    ['a.safetensors'],
    [null],
    [{ name: null }],
    [{ name: '' }],
    [{ name: '/private/a.safetensors' }],
    [{ name: 'C:\\models\\a' }],
    [{ name: '../secret' }],
    [{ name: 'nested/../../secret' }],
    [{ name: 'a\u0000b' }],
    [{ name: 'x'.repeat(1025) }],
    Array.from({ length: 50001 }, () => ({ name: 'a.safetensors' }))
  ])('refuses malformed replies and leaked filesystem paths', async (value) => {
    vi.mocked(api.fetchApi).mockResolvedValue(response(value))
    await expect(createModelsApi().list('loras')).rejects.toThrow(
      /invalid response/
    )
  })

  it('validates the plain fallback too', async () => {
    vi.mocked(api.fetchApi)
      .mockResolvedValueOnce(response(null, 404))
      .mockResolvedValueOnce(response(['/private/a.safetensors']))
    await expect(createModelsApi().list('loras')).rejects.toThrow(
      /invalid response/
    )
  })

  it('rejects invalid JSON without a fallback request', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(
      new Response('{', { status: 200 })
    )
    await expect(createModelsApi().list('loras')).rejects.toThrow(
      /invalid response/
    )
    expect(api.fetchApi).toHaveBeenCalledTimes(1)
  })
})
