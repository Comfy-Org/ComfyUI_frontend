import { describe, expect, it, vi } from 'vitest'

import content from '../content/workshop-display.json'
import { workshopContentInputs } from './workshop-content-inputs'
import { routerWorkshopModels } from './workshop-browse-content'
import { getRouterWorkshopModelDetail } from './workshop-router-content'
import {
  defaultValues,
  schemaForModel,
  urlUploadField,
  validateForm
} from './workshop-playground'
import { prepareWorkshopRouterInput } from './workshop-request'
import { workshopExampleValues } from './workshop-example-values'

const image = 'https://example.com/first.png'
const lastImage = 'https://example.com/last.png'
const video = 'https://example.com/source.mp4'

function detail(slug: string) {
  const page = getRouterWorkshopModelDetail(slug)
  if (!page?.execution) throw new Error(`Missing page: ${slug}`)
  return { ...page, execution: page.execution }
}

async function request(
  slug: string,
  values: Record<string, string | number | boolean> = {}
) {
  const page = detail(slug)
  return prepareWorkshopRouterInput(
    page.execution,
    {
      ...defaultValues(schemaForModel(page), page.defaults),
      ...values
    },
    new AbortController().signal
  )
}

describe('use-case input contracts', () => {
  it('uses dropdowns for every exposed resolution and aspect-ratio control', () => {
    let checked = 0
    for (const model of routerWorkshopModels) {
      for (const field of schemaForModel(detail(model.slug))) {
        if (
          /^(?:param_|setting_|image_)?(?:resolution|aspect_ratio|ratio|aspectRatio)$/.test(
            field.name
          )
        ) {
          checked += 1
          expect({ slug: model.slug, field }).toMatchObject({
            field: { kind: 'select' }
          })
        }
      }
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('keeps Beeble’s output type tied to its image/video page', async () => {
    const slug = 'beeble--switchx-video-edit--edit-videos'
    const body = await request(slug, { source_uri: video })
    expect(body).toHaveProperty('generation_type', 'video')
    expect(
      schemaForModel(detail(slug)).map((field) => field.name)
    ).not.toContain('generation_type')
  })

  it('keeps a valid prompt on every applicable worked example, including rejected legacy prompts', () => {
    for (const model of routerWorkshopModels) {
      const page = detail(model.slug)
      const prompt = schemaForModel(page).find(
        (field) => field.label === 'Prompt'
      )
      if (!prompt) continue
      for (const example of page.examples.filter(
        (example) => !example.sampleOnly
      )) {
        expect({
          slug: page.slug,
          example: example.name,
          prompt: String(example.values[prompt.name] ?? '').trim()
        }).toMatchObject({ prompt: expect.stringMatching(/\S/) })
        expect(
          validateForm([prompt], defaultValues([prompt], example.values))
        ).toEqual({})
      }
    }
  })
  it('binds every curated mode to a real content record and the same Router identity', () => {
    for (const [id, definition] of workshopContentInputs) {
      expect(content.find((entry) => entry.id === id)).toBeDefined()
      const page = getRouterWorkshopModelDetail(id)
      if (definition.unavailableReason) expect(page).toBeUndefined()
      else
        expect(page).toMatchObject({ execution: { id: definition.routerId } })
    }
  })

  it('offers image uploads on every Animate images page and video uploads on every file-based Edit videos page', () => {
    for (const model of routerWorkshopModels) {
      if (
        !model.useCases?.some((value) =>
          ['animate-images', 'edit-videos'].includes(value)
        )
      )
        continue
      const fields = schemaForModel(detail(model.slug))
      const type = model.useCases.includes('animate-images')
        ? 'image/'
        : 'video/'
      const media = fields
        .map((field) => (field.kind === 'file' ? field : urlUploadField(field)))
        .filter((field) =>
          field?.accept.some((accept) => accept.startsWith(type))
        )
      if (model.routerId === 'kling/videos-video-extend') {
        expect(fields.find((field) => field.name === 'video_id')).toMatchObject(
          { required: true }
        )
      } else
        expect({ slug: model.slug, media }).not.toMatchObject({ media: [] })
    }
  })

  it('restores Grok’s source image and only schema-valid settings from the example', async () => {
    const page = detail('xai--grok-imagine-video--animate-images')
    expect(page.defaults.image_url).toContain('sci-fi_mech.png')
    const values = defaultValues(schemaForModel(page), page.defaults)
    expect(validateForm(schemaForModel(page), values)).toEqual({})
    const body = await request(page.slug)
    expect(body).toHaveProperty('image.url', page.defaults.image_url)
    expect(body.aspect_ratio).toBe('16:9')
    expect(body).not.toHaveProperty('medias')
  })

  it('keeps Seedance modes distinct, including both frame roles and multiple reference images', async () => {
    const stem = 'byteplus--seedance-1-0-lite-'
    const suffix = '--animate-images'
    const firstLast = detail(`${stem}first-last-frame${suffix}`)
    const reference = detail(`${stem}image-reference${suffix}`)
    const single = detail(`${stem}image-to-video${suffix}`)
    expect(new Set([firstLast.name, reference.name, single.name]).size).toBe(3)
    const body = await request(firstLast.slug, {
      first_frame_url: image,
      last_frame_url: lastImage
    })
    expect(body.content).toEqual([
      { type: 'text', text: expect.any(String) },
      { type: 'image_url', role: 'first_frame', image_url: { url: image } },
      { type: 'image_url', role: 'last_frame', image_url: { url: lastImage } }
    ])
    const refs = await request(reference.slug, {
      reference_image_url: image,
      reference_image_url_2: lastImage
    })
    expect(refs.content).toEqual([
      { type: 'text', text: expect.any(String) },
      { type: 'image_url', role: 'reference_image', image_url: { url: image } },
      {
        type: 'image_url',
        role: 'reference_image',
        image_url: { url: lastImage }
      }
    ])
    expect(schemaForModel(single).map((field) => field.name)).not.toContain(
      'last_frame_url'
    )
  })

  it.for([
    {
      slug: 'luma--ray-2-image-to-video--animate-images',
      field: 'first_frame_url',
      value: image,
      path: 'keyframes.frame0.url'
    },
    {
      slug: 'wan--image-to-video-3.0--animate-images',
      field: 'image_url',
      value: image,
      path: 'input.media.0.url'
    },
    {
      slug: 'wan--reference-to-video-3.0--animate-images',
      field: 'image_url',
      value: image,
      path: 'input.media.0.url'
    },
    {
      slug: 'gemini--omni-1.1-flash--edit-videos',
      field: 'video_url',
      value: video,
      path: 'input.1.uri'
    },
    {
      slug: 'gemini--omni-1.1-flash--animate-images',
      field: 'image_url',
      value: image,
      path: 'input.1.uri'
    },
    {
      slug: 'bfl--flux-3-video-continuation--edit-videos',
      field: 'start_video',
      value: video,
      path: 'start_video'
    }
  ])(
    'sends the source asset in the native request: $slug',
    async ({ slug, field, value, path }) => {
      expect(await request(slug, { [field]: value })).toHaveProperty(
        path,
        value
      )
      await expect(request(slug, { [field]: '' })).rejects.toMatchObject({
        reason: 'validation'
      })
    }
  )

  it.for([
    { slug: 'bfl--flux-video-upscale--edit-videos', field: 'input_video' },
    { slug: 'bria--green-screen-video--edit-videos', field: 'video' },
    { slug: 'bria--remove-video-background--edit-videos', field: 'video' },
    { slug: 'bria--replace-video-background--edit-videos', field: 'video' },
    { slug: 'runway--aleph2-video-to-video--edit-videos', field: 'videoUri' },
    { slug: 'wavespeed--flashvsr--edit-videos', field: 'video' }
  ])(
    'keeps video URL uploads as source files until upload: $slug',
    async ({ slug, field }) => {
      const page = detail(slug)
      const fields = schemaForModel(page)
      const input = fields.find((item) => item.name === field)
      if (!input) throw new Error('Missing input')
      expect(urlUploadField(input)?.accept).toContain('video/mp4')
      const file = new File(['video'], 'clip.mp4', { type: 'video/mp4' })
      expect(
        validateForm([input], {
          [field]: { name: file.name, type: file.type, size: file.size, file }
        })
      ).toEqual({})
      const upload = vi.fn(async () => video)
      const values = {
        ...defaultValues(fields, page.defaults),
        ...(slug.startsWith('wavespeed--') ? { duration: 5 } : {}),
        ...(slug.startsWith('bria--replace-video-background--')
          ? { background_url: image }
          : {}),
        [field]: { name: file.name, type: file.type, size: file.size, file }
      }
      const body = await prepareWorkshopRouterInput(
        page.execution,
        values,
        new AbortController().signal,
        undefined,
        upload
      )
      expect(upload).toHaveBeenCalledTimes(1)
      expect(body).toHaveProperty(field, video)
    }
  )

  it('rejects invalid seeds and ignores unrecognized or hidden example parameters', () => {
    const page = detail('xai--grok-imagine-video--animate-images')
    const values = workshopExampleValues(page.execution, {
      seed: -1,
      model: 'another/model',
      callback_url: 'https://example.com/callback',
      aspect_ratio: 'bogus',
      duration: '10',
      prompt: 'A fox'
    })
    expect(values).toEqual({ duration: 10, prompt: 'A fox' })
  })
})
