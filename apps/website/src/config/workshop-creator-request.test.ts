import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { routerWorkshopModels } from './workshop-browse-content'
import { getRouterWorkshopModelDetail } from './workshop-router-content'
import {
  defaultValues,
  schemaForModel,
  validateForm
} from './workshop-playground'
import type { FileValue, FormValues } from './workshop-playground'
import type { WorkshopModelDetail } from './models-catalogue'
import { prepareWorkshopRouterInput } from './workshop-request'
import { validateWorkshopInput } from './workshop-json-schema'
import creatorModels from '../data/workshop-creator-models.json'
import { workshopContract } from './workshop-contract-catalog'
import { formForContract } from './workshop-contract'
import { createWorkshopUrlUploader } from './workshop-url-upload'

const imageUrl = 'https://example.invalid/source.png'
const videoUrl = 'https://example.invalid/source.mp4'
const hostilePrompt = 'A "quoted" fox\n\\ on snow 🦊 $repl_string("secret")'

function upload(type = 'image/png'): FileValue {
  const file = new File([new Uint8Array([0, 1, 255, 34])], 'source.png', {
    type
  })
  return { file, name: file.name, size: file.size, type: file.type }
}

function unpublishedModel(id: string): WorkshopModelDetail {
  const slug = id.replace('/', '--')
  return {
    slug,
    name: id,
    workflowCount: 0,
    href: `/models/${slug}/`,
    routerId: id,
    capabilities: [],
    fields: [],
    defaults: {},
    examples: []
  }
}

function modelFor(id: string) {
  const model = getRouterWorkshopModelDetail(id.replace('/', '--'))
  const contract = workshopContract(id)
  if (contract)
    return {
      ...(model ?? unpublishedModel(id)),
      execution: contract,
      form: formForContract(contract)
    }
  if (!model?.execution) throw new Error(`Missing Router contract: ${id}`)
  return { ...model, execution: model.execution }
}

function valuesFor(id: string): FormValues {
  const model = modelFor(id)
  const fields = schemaForModel(model)
  const values = { ...defaultValues(fields, model.defaults) }
  for (const field of fields) {
    if (field.kind === 'file' && typeof values[field.name] === 'object') {
      values[field.name] = upload(field.accept[0])
    }
    if (
      !field.required ||
      !Object.hasOwn(validateForm([field], values), field.name)
    )
      continue
    switch (field.kind) {
      case 'file':
        values[field.name] = upload(field.accept[0])
        break
      case 'select':
        values[field.name] = field.options[0]
        break
      case 'number':
        values[field.name] = field.min ?? 1
        break
      case 'toggle':
        values[field.name] = true
        break
      case 'text':
        values[field.name] = field.name.includes('voice')
          ? 'voice-fixture'
          : imageUrl
        break
    }
  }
  if (
    model.execution.id === 'meshy/remesh' ||
    model.execution.id === 'meshy/rigging'
  )
    values.model_url = 'https://example.invalid/model.glb'
  return values
}

function prepare(id: string, values: FormValues = {}) {
  const uploader = createWorkshopUrlUploader()
  return prepareWorkshopRouterInput(
    modelFor(id).execution,
    { ...valuesFor(id), ...values },
    new AbortController().signal,
    undefined,
    (file, signal) => uploader(file, 'token', 'owner:workspace', signal)
  )
}

const models = routerWorkshopModels.filter(
  (model) => getRouterWorkshopModelDetail(model.slug)?.execution?.creator
)

describe('creator widgets to native Router requests', () => {
  beforeEach(() => {
    let grants = 0
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (_url, init) => {
        if (init?.method === 'POST') {
          grants += 1
          return Response.json({
            upload_url: `https://storage.example/upload-${grants}`,
            download_url: `https://storage.example/image-${grants}.png`
          })
        }
        if (init?.method === 'PUT') {
          return new Response(null)
        }
        return new Response('image bytes', {
          headers: { 'Content-Type': 'image/png' }
        })
      })
    )
  })

  afterEach(() => {
    for (const [url, init] of vi.mocked(fetch).mock.calls) {
      if (init?.method === 'POST') {
        expect(String(url)).toMatch(/\/customers\/storage$/)
        expect(new Headers(init.headers).get('Authorization')).toBe(
          'Bearer token'
        )
      } else {
        expect(new Headers(init?.headers).has('Authorization')).toBe(false)
        if (init?.method === 'PUT') {
          expect(String(url)).toMatch(/^https:\/\/storage\.example\/upload-/)
          expect(init.body).toBeInstanceOf(File)
        } else {
          expect(String(url)).toMatch(
            /^https:\/\/cdn\.jsdelivr\.net\/gh\/Comfy-Org\/workflow_templates@/
          )
        }
      }
    }
  })

  it.for([
    ...new Map(
      routerWorkshopModels.map((model) => [model.routerId, model])
    ).values()
  ])(
    'initializes valid defaults and leaves optional seeds unset: $slug',
    async (model) => {
      const detail = getRouterWorkshopModelDetail(model.slug)
      if (!detail) throw new Error(`Missing model page: ${model.slug}`)
      const fields = schemaForModel(detail)
      const values = defaultValues(fields, detail.defaults)
      for (const field of fields) {
        if (/(?:^|_)seed$/.test(field.name) && !field.required) {
          expect(values[field.name]).toBeUndefined()
          const path =
            field.name === 'param_seed' ? 'parameters.seed' : field.name
          expect(await prepare(model.slug)).not.toHaveProperty(path)
        }
        if (values[field.name] !== undefined && values[field.name] !== '')
          expect(validateForm([field], values)).toEqual({})
      }
    }
  )

  it.for([
    {
      id: 'byteplus/dreamina-seedance-2-0-fast-260128',
      widget: 'seed',
      path: 'seed'
    },
    { id: 'byteplus/seedream-4-0-250828', widget: 'seed', path: 'seed' },
    { id: 'bfl/flux-2-pro', widget: 'seed', path: 'seed' },
    { id: 'elevenlabs/eleven_v3', widget: 'seed', path: 'seed' },
    {
      id: 'wan/wan2.5-t2i-preview',
      widget: 'param_seed',
      path: 'parameters.seed'
    },
    {
      id: 'veo/veo-3.1-generate-001',
      widget: 'param_seed',
      path: 'parameters.seed'
    }
  ])(
    'omits an unset seed, sends explicit zero, and omits it again after clearing: $id',
    async ({ id, widget, path }) => {
      expect(await prepare(id)).not.toHaveProperty(path)
      expect(await prepare(id, { [widget]: 0 })).toHaveProperty(path, 0)
      expect(await prepare(id, { [widget]: undefined })).not.toHaveProperty(
        path
      )
      await expect(prepare(id, { [widget]: 0.5 })).rejects.toMatchObject({
        reason: 'validation'
      })
    }
  )

  it('keeps the required Runway seed valid and rejects a missing or negative seed', async () => {
    const id = 'runway/gen4_turbo'
    const body = await prepare(id)
    expect(body).toHaveProperty('seed', 42)
    expect(
      validateWorkshopInput(body, modelFor(id).execution.inputSchema)
    ).toBe(true)
    await expect(prepare(id, { seed: undefined })).rejects.toMatchObject({
      fieldErrors: { seed: 'required' }
    })
    await expect(prepare(id, { seed: -1 })).rejects.toMatchObject({
      reason: 'validation'
    })
  })

  it('compiles every authored widget definition, including contracts awaiting content joins', () => {
    for (const id of Object.keys(creatorModels.models))
      expect(workshopContract(id)?.creator).toBeDefined()
    expect([...new Set(models.map((model) => model.routerId))].sort()).toEqual(
      Object.keys(creatorModels.models)
        .filter((id) =>
          routerWorkshopModels.some((model) => model.routerId === id)
        )
        .sort()
    )
  })
  it.for(models)(
    '$slug has usable widgets and a schema-valid prepared body',
    async (model) => {
      const detail = modelFor(model.slug)
      const fields = schemaForModel(detail)
      for (const field of fields.filter(
        (field) => field.kind === 'text' && field.valueType === 'json'
      )) {
        const request = detail.execution.creator?.request
        if (request?.kind === 'callback' && request.callback === 'dialogue') {
          expect(field.name).toBe('inputs')
          expect(field.presentation?.control).toBe('dialogue')
        } else {
          expect(request).toMatchObject({
            kind: 'callback',
            callback: 'ideogram',
            options: { mode: 'json' }
          })
          expect(field.name).toBe('prompt')
          expect(field.label).toBe('Structured prompt')
        }
      }
      expect(new Set(fields.map((field) => field.name)).size).toBe(
        fields.length
      )
      const values = valuesFor(model.slug)
      expect(validateForm(fields, values)).toEqual({})
      const body = await prepare(model.slug, values)
      expect(validateWorkshopInput(body, detail.execution.inputSchema)).toBe(
        true
      )
      expect(body).not.toHaveProperty('model')
    }
  )

  it('composes dialogue widgets literally, preserving escaping and numeric types', async () => {
    expect(
      await prepare('elevenlabs/eleven_v3', {
        inputs: JSON.stringify([
          { text: hostilePrompt, voice_id: 'voice-fixture' }
        ]),
        seed: 0
      })
    ).toEqual({
      inputs: [{ text: hostilePrompt, voice_id: 'voice-fixture' }],
      seed: 0
    })
  })

  it.for([
    {
      id: 'openai/gpt-image-1',
      widget: 'size',
      value: '1536x1024',
      expected: { size: '1536x1024', n: 1 }
    },
    {
      id: 'byteplus/seedream-4-0-250828',
      widget: 'size',
      value: '4K',
      expected: { size: '4K', sequential_image_generation: 'disabled' }
    },
    {
      id: 'recraft/recraftv4_pro',
      widget: 'size',
      value: '2688x1536',
      expected: { size: '2688x1536', n: 1 }
    },
    {
      id: 'qwen/qwen-image-3.0',
      widget: 'param_size',
      value: '1536*1024',
      expected: { parameters: { size: '1536*1024', n: 1 } }
    },
    {
      id: 'wan/wan2.5-t2i-preview',
      widget: 'param_size',
      value: '1920*1080',
      expected: { parameters: { size: '1920*1080', n: 1 } }
    },
    {
      id: 'veo/veo-3.1-generate-001',
      widget: 'param_resolution',
      value: '1080p',
      expected: { parameters: { resolution: '1080p', sampleCount: 1 } }
    },
    {
      id: 'xai/grok-imagine-video-1.5',
      widget: 'resolution',
      value: '1080p',
      expected: { resolution: '1080p' }
    }
  ])(
    'sends the selected Resolution as a native value for $id',
    async ({ id, widget, value, expected }) => {
      const fields = schemaForModel(modelFor(id))
      const field = fields.find((entry) => entry.name === widget)
      if (field?.kind !== 'select')
        throw new Error(`Missing resolution dropdown: ${id}`)
      expect(field.label).toBe('Resolution')
      expect(field.options).toContain(value)
      expect(await prepare(id, { [widget]: value })).toMatchObject(expected)
      await expect(
        prepare(id, { [widget]: 'not-a-resolution' })
      ).rejects.toMatchObject({ reason: 'validation' })
    }
  )

  it.for([
    { id: 'qwen/qwen-image-3.0', widget: 'param_n', key: 'n' },
    { id: 'wan/wan2.5-t2i-preview', widget: 'param_n', key: 'n' },
    { id: 'wan/wan2.5-i2i-preview', widget: 'param_n', key: 'n' },
    {
      id: 'veo/veo-3.1-generate-001',
      widget: 'param_sampleCount',
      key: 'sampleCount'
    }
  ])(
    'keeps the nested output count at one without accepting a hidden widget: $id',
    async ({ id, widget, key }) => {
      expect(
        schemaForModel(modelFor(id)).some((field) => field.name === widget)
      ).toBe(false)
      expect(await prepare(id)).toMatchObject({ parameters: { [key]: 1 } })
      await expect(prepare(id, { [widget]: 4 })).rejects.toMatchObject({
        reason: 'validation'
      })
    }
  )

  it('encodes Seedance frames as ordered data URLs and keeps advanced values', async () => {
    const body = await prepare('byteplus/dreamina-seedance-2-0-fast-260128', {
      prompt: hostilePrompt,
      first_frame: upload(),
      last_frame: upload(),
      seed: 123
    })
    expect(body).toMatchObject({
      seed: 123,
      content: [
        { type: 'text', text: hostilePrompt },
        {
          type: 'image_url',
          role: 'first_frame',
          image_url: { url: 'data:image/png;base64,AAH/Ig==' }
        },
        {
          type: 'image_url',
          role: 'last_frame',
          image_url: { url: 'data:image/png;base64,AAH/Ig==' }
        }
      ]
    })
    expect(body).not.toHaveProperty('first_frame')
  })

  it('rejects conflicting Seedance modes and missing required first frames', async () => {
    await expect(
      prepare('byteplus/dreamina-seedance-2-0-fast-260128', {
        last_frame: upload()
      })
    ).rejects.toMatchObject({ fieldErrors: { first_frame: 'rejected' } })
    await expect(
      prepare('byteplus/dreamina-seedance-2-0-fast-260128', {
        first_frame: upload(),
        reference_images: [upload()]
      })
    ).rejects.toMatchObject({ fieldErrors: { reference_images: 'rejected' } })
    await expect(
      prepare('byteplus/seedance-1-0-lite-i2v-250428', {
        first_frame: undefined
      })
    ).rejects.toMatchObject({ fieldErrors: { first_frame: 'required' } })
  })

  it('uses raw Gemini Base64 plus MIME metadata, and nested configuration', async () => {
    const body = await prepare('vertexai/gemini-3-pro-image', {
      prompt: hostilePrompt,
      images: [upload()],
      config_temperature: 0,
      image_aspectRatio: '9:16',
      image_imageSize: '2K'
    })
    expect(body).toMatchObject({
      contents: [
        {
          role: 'user',
          parts: [
            { text: hostilePrompt },
            { inlineData: { data: 'AAH/Ig==', mimeType: 'image/png' } }
          ]
        }
      ],
      generationConfig: {
        temperature: 0,
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio: '9:16', imageSize: '2K' }
      }
    })
    expect(
      (await prepare('vertexai/gemini-2.5-flash-image')).generationConfig
    ).not.toHaveProperty('imageConfig.imageSize')
  })

  it('omits unused Seedream references and preserves the selected image order', async () => {
    const id = 'byteplus/seedream-5-0-pro-260628'
    expect(await prepare(id)).not.toHaveProperty('image')
    expect(await prepare(id, { images: [upload()] })).toHaveProperty(
      'image',
      'data:image/png;base64,AAH/Ig=='
    )
    expect(
      await prepare(id, { images: [upload(), upload('image/jpeg')] })
    ).toHaveProperty('image', [
      'data:image/png;base64,AAH/Ig==',
      'data:image/jpeg;base64,AAH/Ig=='
    ])
  })

  it('composes BRIA edits and Kling lip sync from scalar widgets', async () => {
    expect(
      await prepare('bria/fibo', {
        prompt: hostilePrompt,
        image_url: imageUrl,
        mask_url: imageUrl
      })
    ).toMatchObject({
      instruction: hostilePrompt,
      images: [imageUrl],
      mask: imageUrl
    })
    expect(
      await prepare('kling/videos-lip-sync', {
        video_url: videoUrl,
        audio_url: 'https://example.invalid/voice.mp3'
      })
    ).toEqual({
      input: {
        mode: 'audio2video',
        audio_type: 'url',
        video_url: videoUrl,
        audio_url: 'https://example.invalid/voice.mp3'
      }
    })
  })

  it('encodes Runway first frames as data URLs, not filenames or preview blobs', async () => {
    expect(
      await prepare('runway/gen4_turbo', { images: upload() })
    ).toHaveProperty('promptImage', 'data:image/png;base64,AAH/Ig==')
    expect(
      await prepare('runway/gen4_image', { images: [upload()] })
    ).toHaveProperty('referenceImages', [
      { uri: 'data:image/png;base64,AAH/Ig==' }
    ])
  })

  it('uses Veo frame objects and rejects unsupported MIME types before reading bytes', async () => {
    const body = await prepare('veo/veo-3.1-generate-001', {
      prompt: hostilePrompt,
      first_frame: upload(),
      param_durationSeconds: 6
    })
    expect(body).toMatchObject({
      instances: [
        {
          prompt: hostilePrompt,
          image: { bytesBase64Encoded: 'AAH/Ig==', mimeType: 'image/png' }
        }
      ],
      parameters: { durationSeconds: 6 }
    })
    const image = upload('image/webp')
    if (!image.file) throw new Error('Missing file')
    const read = vi.spyOn(image.file, 'arrayBuffer')
    await expect(
      prepare('veo/veo-3.1-generate-001', { first_frame: image })
    ).rejects.toMatchObject({ fieldErrors: { first_frame: 'badType' } })
    expect(read).not.toHaveBeenCalled()
  })

  it('maps Qwen image URLs and prompt to message parts without leaking UI keys', async () => {
    expect(
      await prepare('qwen/qwen-image-3.0', {
        prompt: hostilePrompt,
        image_url: imageUrl,
        param_seed: 0
      })
    ).toMatchObject({
      input: {
        messages: [
          {
            role: 'user',
            content: [{ image: imageUrl }, { text: hostilePrompt }]
          }
        ]
      },
      parameters: { seed: 0 }
    })
  })

  it.for([
    ['wan/wan2.6-i2v', { img_url: imageUrl }],
    ['wan/wan2.7-i2v', { media: [{ type: 'first_frame', url: imageUrl }] }],
    [
      'wan/happyhorse-1.1-i2v',
      { media: [{ type: 'first_frame', url: imageUrl }] }
    ],
    [
      'wan/happyhorse-1.1-r2v',
      { media: [{ type: 'reference_image', url: imageUrl }] }
    ],
    ['wan/wan2.6-r2v', { reference_video_urls: [videoUrl] }],
    [
      'wan/happyhorse-1.0-video-edit',
      {
        media: [
          { type: 'video', url: videoUrl },
          { type: 'reference_image', url: imageUrl }
        ]
      }
    ]
  ] as const)(
    'preserves the documented media shape for %s',
    async ([id, input]) => {
      const fields = new Set(
        schemaForModel(modelFor(id)).map((field) => field.name)
      )
      const media = Object.fromEntries(
        Object.entries({ image_url: imageUrl, video_url: videoUrl }).filter(
          ([name]) => fields.has(name)
        )
      )
      const body = await prepare(id, { ...media, prompt: hostilePrompt })
      expect(body).toMatchObject({ input: { prompt: hostilePrompt, ...input } })
    }
  )

  it('requires exactly one Meshy source and converts a format dropdown to an array', async () => {
    expect(
      await prepare('meshy/remesh', { target_format: 'fbx' })
    ).toMatchObject({
      model_url: 'https://example.invalid/model.glb',
      target_formats: ['fbx']
    })
    await expect(
      prepare('meshy/remesh', { input_task_id: 'other-source' })
    ).rejects.toMatchObject({ reason: 'validation' })
    await expect(
      prepare('meshy/remesh', { model_url: undefined })
    ).rejects.toMatchObject({ reason: 'validation' })
  })

  it('rejects unowned fields instead of forwarding or silently losing them', async () => {
    await expect(
      prepare('vertexai/gemini-3-pro-image', {
        callback_url: 'https://example.invalid/callback'
      })
    ).rejects.toMatchObject({ fieldErrors: { callback_url: 'rejected' } })
  })

  it('keeps Tencent file metadata structured and makes image vs prompt explicit', async () => {
    const body = await prepare('tencent/hunyuan-3d-texture-edit', {
      file_url: 'https://example.invalid/model.fbx',
      image: upload(),
      EnablePBR: false
    })
    expect(body).toMatchObject({
      File3D: { Type: 'FBX', Url: 'https://example.invalid/model.fbx' },
      Image: { Base64: 'AAH/Ig==' }
    })
    expect(body).not.toHaveProperty('Prompt')
    await expect(
      prepare('tencent/hunyuan-3d-texture-edit', {
        image: upload(),
        EnablePBR: true
      })
    ).rejects.toMatchObject({ fieldErrors: { EnablePBR: 'rejected' } })
  })

  it('limits BFL mode-specific inputs and uses bare Base64 for keyframes', async () => {
    expect(
      await prepare('bfl/flux-3-video', { mode: 'i2v', images: [upload()] })
    ).toMatchObject({ keyframes: ['AAH/Ig=='] })
    await expect(
      prepare('bfl/flux-3-video', { mode: 'i2v' })
    ).rejects.toMatchObject({ fieldErrors: { images: 'required' } })
    await expect(
      prepare('bfl/flux-3-video', { mode: 't2v', images: [upload()] })
    ).rejects.toMatchObject({ fieldErrors: { images: 'rejected' } })
  })

  it('does not mutate inputs, accepts cancellation, and rejects oversized encoding before allocation', async () => {
    const id = 'vertexai/gemini-3-pro-image'
    const values = Object.freeze({ ...valuesFor(id), images: [upload()] })
    const before = structuredClone({
      ...values,
      images: values.images.map(({ name, size, type }) => ({
        name,
        size,
        type
      }))
    })
    await prepareWorkshopRouterInput(
      modelFor(id).execution,
      values,
      new AbortController().signal
    )
    expect({
      ...values,
      images: values.images.map(({ name, size, type }) => ({
        name,
        size,
        type
      }))
    }).toEqual(before)
    const abort = new AbortController()
    abort.abort()
    await expect(
      prepareWorkshopRouterInput(modelFor(id).execution, values, abort.signal)
    ).rejects.toMatchObject({ name: 'AbortError' })
    const large = new File([new Uint8Array(8 * 1024 * 1024)], 'large.png', {
      type: 'image/png'
    })
    const read = vi.spyOn(large, 'arrayBuffer')
    await expect(
      prepare(id, {
        images: [
          { name: large.name, size: large.size, type: large.type, file: large }
        ]
      })
    ).rejects.toMatchObject({ fieldErrors: { images: 'requestTooLarge' } })
    expect(read).not.toHaveBeenCalled()
  })
})
