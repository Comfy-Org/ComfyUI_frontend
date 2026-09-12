import type { AssetInfo } from '@comfyorg/ingest-types'
import { describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

const asset: AssetInfo = {
  id: 'private-model',
  name: 'model.safetensors',
  preview_url: '',
  storage_url: '/models/model.safetensors',
  model: true,
  public: false,
  in_library: true
}

describe('api.getShareableAssets', () => {
  it('preserves asset fields and strips unknown response fields', async () => {
    vi.spyOn(api, 'fetchApi').mockResolvedValue(
      Response.json({
        assets: [{ ...asset, server_metadata: { private: true } }],
        extra: 'ignored'
      })
    )

    await expect(api.getShareableAssets({})).resolves.toEqual({
      assets: [asset]
    })
  })

  it.each([
    { assets: [{ ...asset, public: 'false' }] },
    { assets: [{ ...asset, in_library: undefined }] },
    { assets: null }
  ])('rejects malformed asset responses: %j', async (payload) => {
    vi.spyOn(api, 'fetchApi').mockResolvedValue(Response.json(payload))

    await expect(api.getShareableAssets({})).rejects.toMatchObject({
      name: 'ZodError'
    })
  })
})
