import { describe, expect, it, vi } from 'vitest'

import { loadWorkshopExampleFile } from '../src/config/workshop-example-file'
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

vi.mock(
  import('../src/config/workshop-example-file'),
  async (importOriginal) => ({
    ...(await importOriginal()),
    loadWorkshopExampleFile: vi.fn()
  })
)

describe('router_render', () => {
  it.for([
    {
      slug: 'bfl--flux-3-text-to-video--generate-videos',
      mode: 't2v',
      duration: 20
    },
    {
      slug: 'bfl--flux-3-image-to-video--animate-images',
      mode: 'i2v',
      duration: 20
    }
  ])('maps generic duration to the allowed range for $mode', async (model) => {
    vi.mocked(loadWorkshopExampleFile).mockResolvedValue(
      new File([new Uint8Array([0, 1, 255, 34])], 'source.png', {
        type: 'image/png'
      })
    )
    const prepared = await prepareRouterRender(model.slug, {
      duration_seconds: 20
    })
    expect(prepared.body).toMatchObject({
      mode: model.mode,
      duration: model.duration
    })
  })

  it('rejects an explicit unsupported duration before generation', async () => {
    await expect(
      prepareRouterRender('bfl--flux-3-text-to-video--generate-videos', {
        model_specific: { duration: 21 }
      })
    ).rejects.toMatchObject({
      reason: 'validation',
      fieldErrors: { duration: 'badOption' }
    })
    expect(runWorkshopRouter).not.toHaveBeenCalled()
  })

  it('encodes the initial Veo animation frame while keeping text generation prompt-only', async () => {
    vi.mocked(loadWorkshopExampleFile).mockResolvedValue(
      new File([new Uint8Array([0, 1, 255, 34])], 'source.png', {
        type: 'image/png'
      })
    )

    const animation = await prepareRouterRender(
      'vertexai--veo-3--animate-images'
    )
    expect(animation.body).toMatchObject({
      instances: [
        {
          image: { bytesBase64Encoded: 'AAH/Ig==', mimeType: 'image/png' }
        }
      ]
    })

    const text = await prepareRouterRender('vertexai--veo-3--generate-videos')
    expect(text.body).not.toHaveProperty('instances.0.image')
    expect(text.body).toHaveProperty(
      'instances.0.prompt',
      animation.values.prompt
    )
  })

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
      deadlineCollections: 0,
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
