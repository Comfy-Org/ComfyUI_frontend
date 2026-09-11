import { describe, expect, it } from 'vitest'

import defaultMedia from '../data/router-default-media.json'
import { initialWorkshopPageState } from './workshop-page-state'
import { prepareModelRouterRender } from './router-render'
import { getRouterWorkshopModelDetail } from './workshop-router-content'
import { validateForm } from './workshop-playground'

function modelFor(slug: string) {
  const model = getRouterWorkshopModelDetail(slug)
  if (!model) throw new Error(`Missing model ${slug}`)
  return model
}

describe('runnable page defaults', () => {
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
        mask: defaultMedia.mask
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

  it('leaves a provider video ID missing rather than inventing a completed job', () => {
    const model = modelFor('kling--video-extend--edit-videos')
    const page = initialWorkshopPageState(model)
    expect(validateForm(page.schema, page.values)).toMatchObject({
      video_id: 'required'
    })
  })

  it('sends text lip sync through the text mode using the generic prompt', async () => {
    const request = await prepareModelRouterRender(
      modelFor('kling--lip-sync-text-to-video--edit-videos'),
      { prompt: 'Hello from the playground.' }
    )
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
