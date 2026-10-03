import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import { ComfyApiError } from './errors'
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
})
