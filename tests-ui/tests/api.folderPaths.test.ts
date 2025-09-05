import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

vi.mock('axios')

describe('getFolderPaths', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns legacy API response when available', async () => {
    const mockResponse = { checkpoints: ['/test/checkpoints'] }
    vi.mocked(axios.get).mockResolvedValueOnce({ data: mockResponse })

    const result = await api.getFolderPaths()

    expect(result).toEqual(mockResponse)
  })

  it('falls back to mocked paths when legacy API unavailable', async () => {
    vi.mocked(axios.get).mockRejectedValueOnce(new Error())

    const result = await api.getFolderPaths()

    expect(Object.keys(result)).toEqual([
      'checkpoints',
      'clip',
      'clip_vision',
      'configs',
      'controlnet',
      'diffusion_models',
      'embeddings',
      'gligen',
      'hypernetworks',
      'loras',
      'style_models',
      'unet',
      'upscale_models',
      'vae'
    ])
  })

  it('includes hierarchical paths in fallback', async () => {
    vi.mocked(axios.get).mockRejectedValueOnce(new Error())

    const result = await api.getFolderPaths()

    expect(result.controlnet).toContain(
      '/ComfyUI/models/controlnet/preprocessors'
    )
    expect(result.loras).toContain('/ComfyUI/models/loras/character')
  })
})
