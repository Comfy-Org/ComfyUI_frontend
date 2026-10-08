import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import { ComfyApiError } from './errors'
import type { ModelFolder } from './modelsHandle'
import { createModelsApi } from './modelsHandle'

describe('model catalogue access', () => {
  beforeEach(() => {
    vi.spyOn(api, 'fetchApi').mockImplementation(async (route) => {
      if (route === '/secure-nodes/models/loras') {
        return new Response(JSON.stringify(['styles/a.safetensors']))
      }
      if (route === '/secure-nodes/models/embeddings') {
        return new Response(JSON.stringify(['styles/easynegative.pt']))
      }
      if (
        route ===
        '/secure-nodes/model-sidecar/loras?name=styles%2Fa.safetensors&suffix=.md'
      ) {
        return new Response(JSON.stringify({ content: '# Style\n' }))
      }
      return new Response(null, { status: 404 })
    })
  })

  it('lists logical names and reads adjacent text without exposing paths', async () => {
    const models = createModelsApi()

    await expect(models.list('loras')).resolves.toEqual([
      'styles/a.safetensors'
    ])
    await expect(models.list('embeddings')).resolves.toEqual([
      'styles/easynegative.pt'
    ])
    await expect(
      models.readSidecar('loras', 'styles/a.safetensors', '.md')
    ).resolves.toBe('# Style\n')
    await expect(
      models.readSidecar('loras', 'styles/a.safetensors', '.txt')
    ).resolves.toBeUndefined()
  })

  it('rejects invalid arguments and malformed host responses', async () => {
    const models = createModelsApi()

    await expect(
      Reflect.apply(models.list, models, ['custom_nodes'])
    ).rejects.toThrow(ComfyApiError)
    await expect(
      Reflect.apply(models.readSidecar, models, [
        'loras',
        'styles/a.safetensors',
        '.py'
      ])
    ).rejects.toThrow(ComfyApiError)
    await expect(
      Reflect.apply(models.readSidecar, models, ['loras', '../secret', '.md'])
    ).rejects.toThrow(ComfyApiError)

    vi.mocked(api.fetchApi).mockResolvedValueOnce(
      new Response(JSON.stringify(['/host/model.safetensors']))
    )
    await expect(models.list('loras')).rejects.toThrow(/invalid response/)

    vi.mocked(api.fetchApi).mockResolvedValueOnce(
      new Response(JSON.stringify({ content: 3 }))
    )
    await expect(
      models.readSidecar('loras', 'styles/a.safetensors', '.md')
    ).rejects.toThrow(/invalid response/)
  })

  it.for<ModelFolder>(['ipadapter', 'vae_approx'])(
    'reads the registered %s catalogue and its sidecars',
    async (folder) => {
      vi.mocked(api.fetchApi)
        .mockResolvedValueOnce(
          new Response(JSON.stringify(['components/model.safetensors']))
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ content: 'Model documentation' }))
        )

      const models = createModelsApi()
      await expect(models.list(folder)).resolves.toEqual([
        'components/model.safetensors'
      ])
      await expect(
        models.readSidecar(folder, 'components/model.safetensors', '.md')
      ).resolves.toBe('Model documentation')
      expect(api.fetchApi).toHaveBeenNthCalledWith(
        1,
        `/secure-nodes/models/${folder}`
      )
      expect(api.fetchApi).toHaveBeenNthCalledWith(
        2,
        `/secure-nodes/model-sidecar/${folder}?name=components%2Fmodel.safetensors&suffix=.md`
      )
    }
  )
})
