import { describe, expect, it } from 'vitest'

import defaultMedia from '../data/router-default-media.json'
import { initialWorkshopPageState } from './workshop-page-state'
import { prepareModelRouterRender } from './router-render'
import { routerWorkshopModels } from './workshop-browse-content'
import { getRouterWorkshopModelDetail } from './workshop-router-content'
import { validateForm } from './workshop-playground'
import { applyRouterDefaultInputs } from './router-default-inputs'

function modelFor(slug: string) {
  const model = getRouterWorkshopModelDetail(slug)
  if (!model) throw new Error(`Missing model ${slug}`)
  return model
}

describe('runnable page defaults', () => {
  it('repairs the current Gemini contract example without matching literal prompt text', () => {
    const model = modelFor('gemini--omni-1.1-flash--animate-images')
    if (!model.execution) throw new Error('Missing Gemini contract')
    const page = initialWorkshopPageState(model)
    const updated = {
      ...model,
      execution: {
        ...model.execution,
        inputSchema: {
          ...model.execution.inputSchema,
          example: { input: 'An upstream replacement smoke-test prompt' }
        }
      }
    }
    const repaired = applyRouterDefaultInputs(updated, page.schema, {
      ...page.values,
      input: 'An upstream replacement smoke-test prompt'
    })
    expect(repaired.input).toBe(
      'Generate a short video of a red fox walking through a sunlit forest. The camera follows smoothly as leaves move in the breeze.'
    )
    const authored = applyRouterDefaultInputs(updated, page.schema, {
      ...page.values,
      input: 'An editorial animation prompt'
    })
    expect(authored.input).toBe('An editorial animation prompt')
  })

  it.for([
    'wavespeed--seedvr2-image--edit-images',
    'beeble--switchx-video-edit--edit-videos'
  ])('pins fallback source media for %s to a content commit', (slug) => {
    const model = modelFor(slug)
    const page = initialWorkshopPageState({ ...model, examples: [] })
    expect(JSON.stringify(page.values)).toMatch(
      /workflow_templates@[a-f0-9]{40}\/input\//
    )
    expect(JSON.stringify(page.values)).not.toContain('workflow_templates@main')
  })
  it.for([
    'byteplus--seedance-2-5-first-last-frame--animate-images',
    'byteplus--seedance-2-fast-first-last-frame--animate-images'
  ])('sends both displayed endpoint frames for %s', async (slug) => {
    const model = modelFor(slug)
    const page = initialWorkshopPageState(model)
    expect(validateForm(page.schema, page.values)).toEqual({})
    expect(page.values.first_frame_url).toBeTruthy()
    expect(page.values.last_frame_url).toBeTruthy()
    expect(page.values.first_frame_url).not.toBe(page.values.last_frame_url)
    const request = await prepareModelRouterRender(model)
    expect(request.body.content).toEqual([
      { type: 'text', text: page.values.prompt },
      {
        type: 'image_url',
        role: 'first_frame',
        image_url: { url: page.values.first_frame_url }
      },
      {
        type: 'image_url',
        role: 'last_frame',
        image_url: { url: page.values.last_frame_url }
      }
    ])
  })

  it('sends the displayed reference and preserves generic overrides', async () => {
    const model = modelFor(
      'byteplus--seedance-2-fast-reference--generate-videos'
    )
    const page = initialWorkshopPageState(model)
    const request = await prepareModelRouterRender(model)
    expect(request.body.content).toEqual([
      { type: 'text', text: page.values.prompt },
      {
        type: 'image_url',
        role: 'reference_image',
        image_url: { url: page.values.reference_image_url }
      }
    ])

    const custom = await prepareModelRouterRender(model, {
      prompt: 'Animate the two reference objects.',
      reference_images: [
        'https://example.com/first.png',
        'https://example.com/second.png'
      ]
    })
    expect(custom.body.content).toEqual([
      { type: 'text', text: 'Animate the two reference objects.' },
      {
        type: 'image_url',
        role: 'reference_image',
        image_url: { url: 'https://example.com/first.png' }
      },
      {
        type: 'image_url',
        role: 'reference_image',
        image_url: { url: 'https://example.com/second.png' }
      }
    ])
  })

  it.for([
    'bfl--flux-erase--edit-images',
    'bria--eraser--edit-images',
    'bria--generative-fill--edit-images'
  ])(
    'composes the default source and matching mask as real media for %s',
    async (slug) => {
      const model = modelFor(slug)
      const page = initialWorkshopPageState(model)
      expect(validateForm(page.schema, page.values)).toEqual({})
      expect(page.schema.find((field) => field.name === 'image')?.kind).toBe(
        'file'
      )
      const request = await prepareModelRouterRender(model)
      expect(request.body).toMatchObject({
        image: defaultMedia.image,
        mask:
          slug === 'bria--generative-fill--edit-images'
            ? defaultMedia.partialMask
            : defaultMedia.mask
      })
    }
  )

  it('preserves authored examples and gives unseeded URL pages usable media', () => {
    const model = modelFor('wavespeed--seedvr2-image--edit-images')
    const source = 'https://example.com/authored.png'
    const page = initialWorkshopPageState({
      ...model,
      examples: [],
      defaults: { image: source }
    })
    expect(page.values.image).toBe(source)
    expect(validateForm(page.schema, page.values)).toEqual({})
    const fallback = initialWorkshopPageState(model)
    expect(fallback.values.image).toMatch(/^https:\/\//)
    expect(validateForm(fallback.schema, fallback.values)).toEqual({})
  })

  it('publishes only runnable pages whose first-render inputs validate', () => {
    for (const { slug } of routerWorkshopModels) {
      const model = modelFor(slug)
      expect({ slug, runnable: Boolean(model.execution) }).toEqual({
        slug,
        runnable: true
      })
      const page = initialWorkshopPageState(model)
      expect({ slug, errors: validateForm(page.schema, page.values) }).toEqual({
        slug,
        errors: {}
      })
    }
  })

  it('sends text lip sync through the text mode using the generic prompt', async () => {
    const model = modelFor('kling--lip-sync-text-to-video--edit-videos')
    const page = initialWorkshopPageState(model)
    const initial = await prepareModelRouterRender(model)
    expect(initial.body).toEqual({
      input: {
        mode: 'text2video',
        video_url: page.values.video_url,
        text: 'Welcome to Comfy Cloud. Let us bring your creative ideas to life today.',
        voice_id: 'genshin_vindi2',
        voice_language: 'en',
        voice_speed: 1
      }
    })
    expect(initial.body.input).toMatchObject({ text: page.values.text })

    const request = await prepareModelRouterRender(model, {
      prompt: 'Hello from the playground.'
    })
    expect(request.body).toEqual({
      input: {
        mode: 'text2video',
        video_url: 'https://assets.sync.so/docs/example-video.mp4',
        text: 'Hello from the playground.',
        voice_id: 'genshin_vindi2',
        voice_language: 'en',
        voice_speed: 1
      }
    })
  })
})
