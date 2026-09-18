import { assert, describe, expect, it, vi } from 'vitest'

import content from '../content/workshop-display.json'
import { workshopContentInputs } from './workshop-content-inputs'
import { workshopModels } from './workshop-browse-content'
import { workshopContract } from './workshop-contract-catalog'
import { formForContract } from './workshop-contract'
import { isWorkshopModelDisabled } from './workshop-model-availability'
import { getRouterWorkshopModelDetail } from './workshop-router-content'
import {
  defaultValues,
  schemaForModel,
  urlUploadField,
  validateForm
} from './workshop-playground'
import type { FormValues } from './workshop-playground'
import { prepareWorkshopRouterInput } from './workshop-request'
import { workshopExampleValues } from './workshop-example-values'
import type { WorkshopUrlEncoder } from './workshop-url-input'
import { createWorkshopUrlUploader } from './workshop-url-upload'

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
  values: FormValues = {},
  upload?: WorkshopUrlEncoder
) {
  const page = detail(slug)
  return prepareWorkshopRouterInput(
    page.execution,
    {
      ...defaultValues(schemaForModel(page), page.defaults),
      ...values
    },
    new AbortController().signal,
    undefined,
    upload
  )
}

function genericContract(id: string) {
  const execution = workshopContract(id)
  if (!execution) throw new Error(`Missing contract: ${id}`)
  const fields = schemaForModel({
    fields: [],
    form: formForContract(execution)
  })
  return { execution, fields }
}

async function contractRequest(
  id: string,
  values: FormValues = {},
  upload?: WorkshopUrlEncoder
) {
  const { execution, fields } = genericContract(id)
  return prepareWorkshopRouterInput(
    execution,
    { ...defaultValues(fields), ...values },
    new AbortController().signal,
    undefined,
    upload
  )
}

describe('use-case input contracts', () => {
  it('uses dropdowns for every exposed resolution and aspect-ratio control', () => {
    let checked = 0
    for (const model of workshopModels) {
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
    for (const model of workshopModels) {
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
      if (definition.unavailableReason || isWorkshopModelDisabled(id))
        expect(page).toBeUndefined()
      else
        expect(page).toMatchObject({ execution: { id: definition.routerId } })
    }
  })

  it('renders a different input set for every page that shares a Router model with a sibling page', () => {
    const routerLimited = new Set<string>()
    const siblings = new Map<string, string[]>()
    for (const entry of content) {
      if (isWorkshopModelDisabled(entry.slug)) continue
      if (!getRouterWorkshopModelDetail(entry.slug)?.execution) continue
      siblings.set(entry.modelId, [
        ...(siblings.get(entry.modelId) ?? []),
        entry.slug
      ])
    }
    let checked = 0
    for (const [modelId, slugs] of siblings) {
      if (slugs.length < 2 || routerLimited.has(modelId)) continue
      checked += 1
      const shapes = slugs.map((slug) =>
        schemaForModel(detail(slug))
          .map((field) => `${field.name}${field.required ? '*' : ''}`)
          .sort()
          .join(',')
      )
      expect({ modelId, slugs, distinct: new Set(shapes).size }).toMatchObject({
        distinct: slugs.length
      })
    }
    expect(checked).toBeGreaterThanOrEqual(7)
  })

  it('offers image uploads on every Animate images page and video uploads on every file-based Edit videos page', () => {
    for (const model of workshopModels) {
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
      expect({ slug: model.slug, media }).not.toMatchObject({ media: [] })
    }
  })

  it('restores Grok’s source image and only schema-valid settings from the example', async () => {
    const page = detail('xai--grok-imagine-video--animate-images')
    expect(page.defaults.image_url).toContain(
      'grok-imagine-video-input-4.1.png'
    )
    const values = defaultValues(schemaForModel(page), page.defaults)
    expect(validateForm(schemaForModel(page), values)).toEqual({})
    const body = await request(page.slug)
    expect(body).toHaveProperty('image.url', page.defaults.image_url)
    expect(body.aspect_ratio).toBe('16:9')
    expect(body).not.toHaveProperty('medias')
  })

  it('sends the Seedance 2.5 edit page source video as a reference_video content item', async () => {
    const edit = detail('byteplus--seedance-2-5-edit-video--edit-videos')
    const video = 'https://example.com/source.mp4'
    const body = await request(edit.slug, { video_url: video })
    expect(body.content).toEqual([
      { type: 'text', text: expect.any(String) },
      { type: 'video_url', role: 'reference_video', video_url: { url: video } }
    ])
    expect(edit.name).not.toBe(
      detail('byteplus--seedance-2-5-reference--generate-videos').name
    )
  })

  it.for(['byteplus--seedance-2-fast-', 'byteplus--seedance-2-5-'])(
    'keeps %s role pages distinct, including both frame roles and multiple reference images',
    async (stem) => {
      const firstLast = detail(`${stem}first-last-frame--animate-images`)
      const reference = detail(`${stem}reference--generate-videos`)
      const single = detail(`${stem}text-to-video--generate-videos`)
      expect(new Set([firstLast.name, reference.name, single.name]).size).toBe(
        3
      )
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
        {
          type: 'image_url',
          role: 'reference_image',
          image_url: { url: image }
        },
        {
          type: 'image_url',
          role: 'reference_image',
          image_url: { url: lastImage }
        }
      ])
      expect(
        schemaForModel(reference).map((field) => field.name)
      ).not.toContain('first_frame_url')
      expect(schemaForModel(single).map((field) => field.name)).not.toContain(
        'reference_image_url'
      )
    }
  )

  it.for([
    {
      slug: 'kling--omni-pro-edit-video--edit-videos',
      routerId: 'kling/kling-v3-omni',
      values: {
        keep_original_sound: false,
        reference_image_url: image,
        resolution: '720p',
        video_url: video
      },
      expected: {
        mode: 'std',
        sound: undefined,
        image_list: [{ image_url: image }],
        video_list: [
          {
            video_url: video,
            refer_type: 'base',
            keep_original_sound: 'no'
          }
        ]
      }
    },
    {
      slug: 'kling--omni-pro-first-last-frame--animate-images',
      routerId: 'kling/kling-v3-omni',
      values: { first_frame_url: image, last_frame_url: lastImage },
      expected: {
        mode: 'pro',
        sound: 'on',
        image_list: [
          { image_url: image, type: 'first_frame' },
          { image_url: lastImage, type: 'end_frame' }
        ],
        video_list: undefined
      }
    },
    {
      slug: 'kling--omni-pro-image-to-video--animate-images',
      routerId: 'kling/kling-v3-omni',
      values: { reference_image_url: image },
      expected: {
        mode: 'pro',
        sound: 'on',
        image_list: [{ image_url: image }],
        video_list: undefined
      }
    },
    {
      slug: 'kling--omni-pro-text-to-video--generate-videos',
      routerId: 'kling/kling-video-o1',
      values: {},
      expected: {
        mode: 'std',
        sound: undefined,
        image_list: undefined,
        video_list: undefined
      }
    },
    {
      slug: 'kling--omni-pro-video-to-video--edit-videos',
      routerId: 'kling/kling-v3-omni',
      values: { reference_image_url: image, video_url: video },
      expected: {
        mode: 'pro',
        sound: undefined,
        image_list: [{ image_url: image }],
        video_list: [
          {
            video_url: video,
            refer_type: 'feature',
            keep_original_sound: 'no'
          }
        ]
      }
    }
  ])(
    'keeps $slug as a role-specific page on its shared Router endpoint',
    async ({ slug, routerId, values, expected }) => {
      expect(detail(slug).execution.id).toBe(routerId)
      const body = await request(slug, values)
      expect({
        mode: body.mode,
        sound: body.sound,
        image_list: body.image_list,
        video_list: body.video_list
      }).toEqual(expected)
    }
  )

  it('rejects Kling reference images combined with an end frame', async () => {
    await expect(
      request('kling--omni-pro-first-last-frame--animate-images', {
        first_frame_url: image,
        last_frame_url: lastImage,
        reference_image_url: image
      })
    ).rejects.toMatchObject({
      fieldErrors: { reference_image_url: 'rejected' }
    })
  })

  it('offers Kling native audio only on the V3 Omni roles that support it', () => {
    const fields = (slug: string) =>
      schemaForModel(detail(slug)).map((field) => field.name)
    expect(
      fields('kling--omni-pro-first-last-frame--animate-images')
    ).toContain('generate_audio')
    expect(fields('kling--omni-pro-image-to-video--animate-images')).toContain(
      'generate_audio'
    )
    expect(
      fields('kling--omni-pro-text-to-video--generate-videos')
    ).not.toContain('generate_audio')
  })

  it('binds the authored LTX Pro page without exposing its old variant selector', async () => {
    const slug = 'ltx--text-to-video-v2--generate-videos'
    expect(detail(slug).execution.id).toBe('ltx/ltx-2-5-pro')
    const body = await request(slug)
    expect(body).toMatchObject({
      prompt: expect.stringMatching(/\S/),
      resolution: '1280x720'
    })
    expect(body).not.toHaveProperty('variant')
    expect(body).not.toHaveProperty('model')
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
      slug: 'gemini--omni-1.1-flash--animate-images',
      field: 'image_url',
      value: image,
      path: 'input.1.uri'
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

  it('keeps a supplied Wan reference URL and rehosts a pinned companion', async () => {
    const slug = 'wan--reference-to-video-3.0--animate-images'
    const source =
      'https://cdn.jsdelivr.net/gh/Comfy-Org/workflow_templates@3db6490611e6a16b84b09110e61a07264ce47cd3/input/reference.png'
    expect(source).toEqual(expect.stringContaining('@'))
    const stored = 'https://storage.example/reference.png'
    const transport = vi.fn<typeof fetch>(async (url, init) => {
      if (init?.method === 'POST') {
        return Response.json({
          upload_url: 'https://storage.example/upload',
          download_url: stored
        })
      }
      if (init?.method === 'PUT') {
        return new Response(null)
      }
      return new Response(String(url), {
        headers: { 'Content-Type': 'image/png' }
      })
    })
    vi.stubGlobal('fetch', transport)
    const uploader = createWorkshopUrlUploader()
    const upload = (file: File, signal: AbortSignal) =>
      uploader(file, 'token', 'owner:workspace', signal)
    expect(
      await request(slug, { image_url: image, image_url_2: source }, upload)
    ).toMatchObject({
      input: {
        media: [
          { type: 'reference_image', url: image },
          { type: 'reference_image', url: stored }
        ]
      }
    })
    expect(transport).toHaveBeenCalledTimes(3)
    expect(transport.mock.calls[0][0]).toBe(source)
    expect(String(transport.mock.calls[1][0])).toMatch(/\/customers\/storage$/)
    expect(transport.mock.calls[2][0]).toBe('https://storage.example/upload')
    const uploaded = transport.mock.calls[2][1]?.body
    expect(uploaded).toBeInstanceOf(File)
    if (!(uploaded instanceof File)) throw new Error('Missing upload')
    expect(uploaded.type).toBe('image/png')
    expect(await uploaded.text()).toBe(source)
    await expect(
      request(slug, { image_url: '' }, upload)
    ).rejects.toMatchObject({
      reason: 'validation'
    })
    expect(transport).toHaveBeenCalledTimes(3)
  })

  it.for([
    'gemini--omni-1.1-flash--edit-videos',
    'gemini--omni-flash-preview--edit-videos'
  ])('sends source video bytes with their MIME type for %s', async (slug) => {
    const file = new File(['video bytes'], 'clip.mp4', { type: 'video/mp4' })
    const body = await request(slug, {
      video: { file, name: file.name, type: file.type, size: file.size }
    })
    expect(body).toHaveProperty('input.1', {
      type: 'video',
      data: btoa('video bytes'),
      mime_type: 'video/mp4'
    })
    await expect(request(slug, { video: undefined })).rejects.toMatchObject({
      fieldErrors: { video: 'required' }
    })
  })

  it.for([
    { slug: 'freepik--magnific-skin-enhancer--edit-images' },
    { slug: 'freepik--magnific-upscaler-precise-v2--edit-images' }
  ])('uploads the Magnific source image for $slug', async ({ slug }) => {
    const page = detail(slug)
    const fields = schemaForModel(page)
    const input = fields.find((field) => field.name === 'image')
    assert(input)
    expect(input.label).toBe('Source image')
    expect(urlUploadField(input)?.accept).toContain('image/png')

    const file = new File(['portrait'], 'portrait.png', { type: 'image/png' })
    const upload = vi.fn<WorkshopUrlEncoder>(async () => image)
    const body = await request(
      slug,
      {
        image: { file, name: file.name, type: file.type, size: file.size }
      },
      upload
    )

    expect(upload).toHaveBeenCalledTimes(1)
    expect(upload).toHaveBeenCalledWith(file, expect.any(AbortSignal))
    expect(body).toHaveProperty('image', image)
  })

  it.for([
    'freepik/ai-skin-enhancer-faithful',
    'freepik/ai-skin-enhancer-flexible'
  ])('uploads the Magnific source image for contract %s', async (id) => {
    const { fields } = genericContract(id)
    const input = fields.find((field) => field.name === 'image')
    assert(input)
    expect(input.label).toBe('Source image')
    expect(urlUploadField(input)?.accept).toContain('image/png')

    const file = new File(['portrait'], 'portrait.png', { type: 'image/png' })
    const upload = vi.fn<WorkshopUrlEncoder>(async () => image)
    const body = await contractRequest(
      id,
      {
        image: { file, name: file.name, type: file.type, size: file.size }
      },
      upload
    )

    expect(upload).toHaveBeenCalledTimes(1)
    expect(upload).toHaveBeenCalledWith(file, expect.any(AbortSignal))
    expect(body).toHaveProperty('image', image)
  })

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
