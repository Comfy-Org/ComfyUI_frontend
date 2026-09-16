import { describe, expect, it } from 'vitest'

import { prepareModelRouterRender } from '../src/config/router-render'
import { getRouterWorkshopModelDetail } from '../src/config/workshop-router-content'
import {
  prepareRouterRender,
  resolveRouterRender,
  router_for_model
} from './router-render'

const prompt = 'A blue ceramic fox'
const standard = {
  prompt,
  size: '1100x760',
  resolution: '4096',
  aspect_ratio: '3:2',
  duration_seconds: 8.2,
  quality: 0.8,
  generate_audio: false
}

describe('standard inputs across model families', () => {
  it('keeps derived dimensions proportional at a model limit and exposes the same mapping through helpers', async () => {
    const slug = 'bfl--flux-2-pro--generate-images'
    const router = router_for_model(slug)
    const prepared = await prepareRouterRender(slug, {
      aspect_ratio: '16:9',
      resolution: '2K'
    })
    expect(prepared.body).toMatchObject({ width: 2048, height: 1152 })
    const portrait = router.router_get_closest_value('9:16', 'aspect_ratio')
    expect(portrait).toEqual({ width: 1024, height: 1820 })
    expect(
      (await prepareRouterRender(slug, { aspect_ratio: '9:16' })).body
    ).toMatchObject(portrait)
    expect(router.router_get_default_value('aspect_ratio')).toEqual({
      width: 1024,
      height: 1024
    })
  })

  it('uses the page modality to choose a source when the same generic input contains images and videos', async () => {
    const sources = {
      source_images: ['https://example.com/image.png'],
      source_videos: ['https://example.com/video.mp4']
    }
    expect(
      (
        await prepareRouterRender(
          'beeble--switchx-video-edit--edit-videos',
          sources
        )
      ).body.source_uri
    ).toBe(sources.source_videos[0])
    expect(
      (
        await prepareRouterRender(
          'beeble--switchx-image-edit--edit-images',
          sources
        )
      ).body.source_uri
    ).toBe(sources.source_images[0])
  })

  it('uses the same ordered media mapping in the helper and renderer', () => {
    const slug = 'qwen--qwen-image-3.0-image-edit--edit-images'
    const references = [
      'https://example.com/a.png',
      'https://example.com/b.png'
    ]
    const router = router_for_model(slug)
    expect(
      router.router_get_closest_value(references, 'reference_images')
    ).toEqual(references)
    expect(
      resolveRouterRender(slug, { reference_images: references }).values
    ).toMatchObject({
      image_url: references[0],
      image_url_2: references[1],
      image_url_3: undefined
    })
  })
  it.for([
    {
      slug: 'byteplus--seedream-4--generate-images',
      expected: { prompt, size: '4K' }
    },
    {
      slug: 'vertexai--gemini-3-pro-image--generate-images',
      expected: {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          imageConfig: { aspectRatio: '3:2', imageSize: '4K' }
        }
      }
    },
    {
      slug: 'ideogram--v4--generate-images',
      expected: {
        json_prompt: { high_level_description: prompt },
        rendering_speed: 'QUALITY'
      }
    },
    {
      slug: 'luma--ray-2-text-to-video--generate-videos',
      expected: {
        prompt,
        duration: '9s',
        resolution: '4k',
        aspect_ratio: '4:3'
      }
    },
    {
      slug: 'kling--text-to-video-with-audio--generate-videos',
      expected: { prompt, duration: '8', mode: 'pro', sound: 'off' }
    },
    {
      slug: 'byteplus--seedance-2-5-text-to-video--generate-videos',
      expected: {
        content: [{ type: 'text', text: prompt }],
        duration: 8,
        resolution: '1080p',
        generate_audio: false
      }
    },
    {
      slug: 'recraft--v4.1-text-to-vector--generate-images',
      expected: { prompt, size: '3:2' }
    }
  ])(
    'compiles the same standard settings for $slug',
    async ({ slug, expected }) => {
      expect((await prepareRouterRender(slug, standard)).body).toMatchObject(
        expected
      )
    }
  )

  const first = new File(['FIRST'], 'first.png', { type: 'image/png' })
  const last = new File(['LAST'], 'last.png', { type: 'image/png' })
  const reference = new File(['REF'], 'ref.png', { type: 'image/png' })
  const media = {
    prompt,
    source_images: [first],
    reference_images: [reference],
    source_videos: ['https://example.com/video.mp4']
  }

  it.for([
    {
      slug: 'bfl--flux-2-max--generate-images',
      expected: { input_image: 'RklSU1Q=', input_image_2: 'UkVG' }
    },
    {
      slug: 'byteplus--seedream-4--edit-images',
      expected: {
        image: ['data:image/png;base64,RklSU1Q=', 'data:image/png;base64,UkVG']
      }
    },
    {
      slug: 'qwen--qwen-image-3.0-image-edit--edit-images',
      expected: {
        input: {
          messages: [
            {
              role: 'user',
              content: [
                { image: 'https://example.com/first.png' },
                { image: 'https://example.com/ref.png' },
                { text: prompt }
              ]
            }
          ]
        }
      }
    },
    {
      slug: 'bfl--flux-virtual-try-on--edit-images',
      expected: {
        person: 'https://example.com/first.png',
        garment: 'https://example.com/ref.png'
      }
    },
    {
      slug: 'bria--replace-video-background--edit-videos',
      expected: {
        video: 'https://example.com/video.mp4',
        background_url: 'https://example.com/ref.png'
      }
    }
  ])(
    'preserves source and reference roles for $slug',
    async ({ slug, expected }) => {
      const model = getRouterWorkshopModelDetail(slug)
      if (!model) throw new Error(`Missing model ${slug}`)
      const prepared = await prepareModelRouterRender(model, media, {
        uploadFile: async (file) => `https://example.com/${file.name}`
      })
      expect(prepared.body).toMatchObject(expected)
    }
  )

  it.for([
    {
      slug: 'runway--gen4-turbo-image-to-video--animate-images',
      expected: { promptImage: 'data:image/png;base64,RklSU1Q=' }
    },
    {
      slug: 'bfl--flux-3-image-to-video--animate-images',
      expected: { keyframes: ['RklSU1Q=', 'TEFTVA=='] }
    },
    {
      slug: 'gemini--omni-1.1-flash--animate-images',
      expected: {
        input: [
          { type: 'text', text: prompt },
          { type: 'image', uri: 'https://example.com/first.png' },
          { type: 'image', uri: 'https://example.com/last.png' }
        ]
      }
    }
  ])(
    'uses explicit frames instead of prior defaults or reference fallback for $slug',
    async ({ slug, expected }) => {
      const model = getRouterWorkshopModelDetail(slug)
      if (!model) throw new Error(`Missing model ${slug}`)
      const prepared = await prepareModelRouterRender(
        model,
        {
          prompt,
          reference_images: [reference],
          first_frame: first,
          last_frame: last
        },
        { uploadFile: async (file) => `https://example.com/${file.name}` }
      )
      expect(prepared.body).toMatchObject(expected)
    }
  )
})
