import type { WorkflowApiAssetsResponse } from '@comfyorg/ingest-types'
import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'

import type {
  PromptFailureResponse,
  PromptResponse
} from '@/platform/remote/comfyui/types'
import { api, PromptExecutionError } from '@/scripts/api'

describe('ComfyApi response boundaries', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('models prompt success separately from prompt failure', () => {
    const success = { prompt_id: 'job-17' } satisfies PromptResponse
    const failure = {
      error: {
        type: 'prompt_outputs_failed_validation',
        message: 'Prompt outputs failed validation',
        details: ''
      }
    } satisfies PromptFailureResponse

    expectTypeOf(success).toExtend<PromptResponse>()
    expectTypeOf<PromptResponse>().not.toHaveProperty('error')
    expect(new PromptExecutionError(failure).response).toEqual(failure)
  })

  it('formats prompt failures without a nested error', () => {
    expect(
      new PromptExecutionError({
        message: 'Gateway rejected prompt'
      }).toString()
    ).toBe('Gateway rejected prompt')
  })

  it.for([
    { name: 'null response', payload: null },
    { name: 'missing data', payload: {} },
    { name: 'non-string data', payload: { data: 17 } },
    { name: 'empty data', payload: { data: '' } }
  ])('rejects $name with the endpoint error', async ({ payload }) => {
    vi.mocked(global.fetch).mockResolvedValue(Response.json(payload))

    await expect(api.getGlobalSubgraphData('blueprint-17')).rejects.toThrow(
      "Global subgraph 'blueprint-17' returned empty data"
    )
  })

  it('returns valid shareable assets', async () => {
    const response: WorkflowApiAssetsResponse = {
      assets: [
        {
          id: 'asset-17',
          in_library: true,
          model: false,
          name: 'preview.png',
          preview_url: '/preview.png',
          public: false,
          storage_url: '/assets/preview.png'
        }
      ]
    }
    vi.mocked(global.fetch).mockResolvedValue(Response.json(response))

    await expect(api.getShareableAssets({})).resolves.toEqual(response)
  })

  it('rejects malformed successful shareable-assets responses', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      Response.json({
        assets: [
          {
            in_library: true,
            model: false,
            name: 'preview.png',
            preview_url: '/preview.png',
            public: false,
            storage_url: '/assets/preview.png'
          }
        ]
      })
    )

    await expect(api.getShareableAssets({})).rejects.toMatchObject({
      name: 'ZodError'
    })
  })
})
