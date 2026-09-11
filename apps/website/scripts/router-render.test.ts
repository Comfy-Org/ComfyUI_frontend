import { describe, expect, it, vi } from 'vitest'

import { runWorkshopRouter } from '../src/config/workshop-router'
import { WorkshopRouterError } from '../src/config/workshop-router-errors'
import {
  prepareRouterRender,
  router_for_model,
  router_render
} from './router-render'

vi.mock(import('../src/config/workshop-router'), async (importOriginal) => ({
  ...(await importOriginal()),
  runWorkshopRouter: vi.fn()
}))

describe('router_render', () => {
  it.for([
    'openai--gpt-image-1--edit-images',
    'openai--gpt-image-1.5--edit-images',
    'openai--gpt-image-2--edit-images'
  ])(
    'omits optional PNG compression for the initial %s request',
    async (slug) => {
      const initial = await prepareRouterRender(slug)
      expect(initial.body.output_format).toBe('png')
      expect(initial.body).not.toHaveProperty('output_compression')

      for (const output_format of ['jpeg', 'webp']) {
        const compressed = await prepareRouterRender(slug, {
          output_format,
          model_specific: { output_compression: 80 }
        })
        expect(compressed.body).toMatchObject({
          output_format,
          output_compression: 80
        })
      }
    }
  )

  it('maps a generic prompt into structured image and spoken dialogue inputs', async () => {
    const prompt = 'A blue ceramic fox'
    const image = await prepareRouterRender('ideogram--v4--generate-images', {
      prompt
    })
    expect(image.body.json_prompt).toEqual({ high_level_description: prompt })
    const audio = await prepareRouterRender(
      'elevenlabs--text-to-dialogue--audio',
      { prompt }
    )
    expect(audio.body.inputs).toEqual([
      { text: prompt, voice_id: '21m00Tcm4TlvDq8ikWAM' }
    ])
  })

  it('uses the bound default and closest-value helpers in the compiled request', async () => {
    const slug = 'bfl--flux-2-pro--generate-images'
    const router = router_for_model(slug)
    const prepared = await prepareRouterRender(slug, { size: '1100x700' })
    expect(prepared.body).toMatchObject(
      router.router_get_closest_value('1100x700', 'size')
    )
    expect(prepared.body.prompt).toBe(router.router_get_default_value('prompt'))
  })

  it('starts with page values and maps supported generic parameters', async () => {
    const prepared = await prepareRouterRender(
      'bfl--flux-2-pro--generate-images',
      {
        prompt: 'A blue ceramic fox',
        seed: 1234,
        size: { width: 1024, height: 768 },
        output_format: 'png'
      }
    )

    expect(prepared).toMatchObject({
      routerId: 'bfl/flux-2-pro',
      expectedKind: 'image',
      body: {
        prompt: 'A blue ceramic fox',
        seed: 1234,
        width: 1024,
        height: 768,
        output_format: 'png'
      }
    })
  })

  it('applies model-specific page fields last and rejects unknown fields', async () => {
    const prepared = await prepareRouterRender(
      'bfl--flux-2-pro--generate-images',
      {
        seed: 1,
        model_specific: { seed: 2, prompt_upsampling: false }
      }
    )

    expect(prepared.body).toMatchObject({
      seed: 2,
      prompt_upsampling: false
    })
    await expect(
      prepareRouterRender('bfl--flux-2-pro--generate-images', {
        model_specific: { invented_parameter: true }
      })
    ).rejects.toMatchObject({
      reason: 'validation',
      fieldErrors: { invented_parameter: 'rejected' }
    })
  })

  it('fails before a paid request when required inputs are cleared', async () => {
    await expect(
      prepareRouterRender('bfl--flux-erase--edit-images', {
        model_specific: { image: undefined, mask: undefined }
      })
    ).rejects.toMatchObject({
      reason: 'validation',
      fieldErrors: { image: 'required', mask: 'required' }
    })
    expect(runWorkshopRouter).not.toHaveBeenCalled()
  })

  it('uses COMFY_KEY through the production page Router client', async () => {
    vi.stubEnv('COMFY_KEY', 'comfyui-test-key')
    vi.mocked(runWorkshopRouter).mockResolvedValue({
      requestId: 'request-1',
      outputs: [
        {
          kind: 'image',
          url: 'https://example.com/output.webp',
          fileName: 'output.webp'
        }
      ]
    })

    const result = await router_render(
      'bfl--flux-2-pro--generate-images',
      {},
      { idempotencyKey: 'render-1' }
    )

    expect(result).toMatchObject({
      slug: 'bfl--flux-2-pro--generate-images',
      routerId: 'bfl/flux-2-pro',
      expectedKind: 'image',
      requestId: 'request-1'
    })
    expect(runWorkshopRouter).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'comfyui-test-key',
        idempotencyKey: 'render-1'
      })
    )
  })

  it('reports a missing key as unavailable without exposing credentials', async () => {
    vi.stubEnv('COMFY_KEY', '')
    vi.mocked(runWorkshopRouter).mockRejectedValue(
      new WorkshopRouterError('unavailable')
    )

    await expect(
      router_render('bfl--flux-2-pro--generate-images', {})
    ).rejects.toMatchObject({ reason: 'unavailable' })
  })
})
