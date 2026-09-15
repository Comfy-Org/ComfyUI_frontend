import { describe, expect, it } from 'vitest'

import {
  createRouterParameters,
  mapRouterParameters
} from './router-parameters'
import type { FieldSchema } from './workshop-playground'
import { defaultValues, validateForm } from './workshop-playground'

const prompt: FieldSchema = {
  kind: 'text',
  name: 'prompt',
  label: 'Prompt',
  required: true,
  multiline: true,
  defaultValue: 'A small red fox'
}

function select(
  name: string,
  options: readonly (string | number | boolean)[]
): FieldSchema {
  return {
    kind: 'select',
    name,
    label: name,
    options,
    defaultValue: options[0]
  }
}

describe('normalized Router parameters', () => {
  it('maps positive seconds to real durations rather than provider automatic sentinels', () => {
    const fields = [select('duration', [-1, 4, 5, 6])]
    expect(mapRouterParameters(fields, {}, { duration_seconds: 1 })).toEqual({
      duration: 4
    })
  })
  it('ignores unrankable options and preserves the first nearest value on ties', () => {
    const fields = [select('duration', [-1, 0, 4, 6, 'automatic'])]
    expect(mapRouterParameters(fields, {}, { duration_seconds: 5 })).toEqual({
      duration: 4
    })
    expect(() =>
      mapRouterParameters(
        [select('duration', [-1, 0, 'automatic'])],
        {},
        { duration_seconds: 5 }
      )
    ).toThrow(
      expect.objectContaining({
        reason: 'validation',
        fieldErrors: { duration: 'rejected' }
      })
    )
  })
  it('bins duration, dimensions, aspect ratio and resolution into native enum values', () => {
    const fields = [
      prompt,
      select('param_duration', ['5', '10']),
      select('param_size', ['1024*1024', '1536*1024', '1024*1536']),
      select('ratio', ['1x1', '16x9', '9x16']),
      select('param_resolution', ['720P', '1080P', '4k'])
    ]
    const values = mapRouterParameters(fields, defaultValues(fields), {
      prompt: 'A blue heron',
      duration_seconds: 8.6,
      size: '1472x960',
      aspect_ratio: '1.7:1',
      resolution: '2160p'
    })
    expect(values).toEqual({
      prompt: 'A blue heron',
      param_duration: '10',
      param_size: '1536*1024',
      ratio: '16x9',
      param_resolution: '4k'
    })
    expect(validateForm(fields, values)).toEqual({})
  })

  it('maps size to separate dimension fields and uses their valid step grid', () => {
    const fields: FieldSchema[] = ['width', 'height'].map((name) => ({
      kind: 'number',
      name,
      label: name,
      min: 256,
      max: 1536,
      step: 64,
      defaultValue: 1024
    }))
    const router = createRouterParameters(fields, defaultValues(fields))
    expect(router.router_get_closest_value('2000x700', 'size')).toEqual({
      width: 1536,
      height: 704
    })
    const result = router.resolve({ size: { width: 2000, height: 700 } })
    expect(result).toEqual({ width: 1536, height: 704 })
    expect(validateForm(fields, result)).toEqual({})
  })

  it('uses native schema multipleOf rather than the UI step and clamps to a valid boundary', () => {
    const fields: FieldSchema[] = [
      {
        kind: 'number',
        name: 'steps',
        label: 'Steps',
        min: 3,
        max: 15,
        step: 1,
        inputSchema: { type: 'integer', minimum: 3, maximum: 15, multipleOf: 4 }
      }
    ]
    expect(mapRouterParameters(fields, {}, { steps: 99 })).toEqual({
      steps: 12
    })
    expect(mapRouterParameters(fields, {}, { steps: 1 })).toEqual({ steps: 4 })
  })

  it('maps numeric quality onto categorical scales and supports explicit endpoint labels', () => {
    const fields = [select('quality', ['low', 'medium', 'high'])]
    expect(mapRouterParameters(fields, {}, { quality: 0.85 })).toEqual({
      quality: 'high'
    })
    const custom = [select('rendering_speed', ['TURBO', 'QUALITY'])]
    expect(
      mapRouterParameters(
        custom,
        {},
        { quality: 0.75 },
        {
          rendering_speed: {
            parameter: 'quality',
            options: { TURBO: 0, QUALITY: 1 }
          }
        }
      )
    ).toEqual({ rendering_speed: 'QUALITY' })
  })

  it('preserves the actual page defaults and gives strict overrides final precedence', () => {
    const fields = [prompt, select('duration', [5, 10])]
    const defaults = { prompt: 'Page example', duration: 10 }
    const router = createRouterParameters(fields, defaults)
    expect(router.router_get_default_value('prompt')).toBe('Page example')
    expect(
      router.resolve({ source_audio: ['https://example.com/input.wav'] })
    ).toEqual(defaults)
    expect(
      router.resolve({
        prompt: 'Generic',
        duration_seconds: 3,
        model_specific: { prompt: 'Native', duration: 10 }
      })
    ).toEqual({ prompt: 'Native', duration: 10 })
    expect(() => router.resolve({ model_specific: { duration: 7 } })).toThrow(
      expect.objectContaining({
        reason: 'validation',
        fieldErrors: { duration: 'badOption' }
      })
    )
    expect(() => router.resolve({ model_specific: { duraton: 5 } })).toThrow(
      expect.objectContaining({
        reason: 'validation',
        fieldErrors: { duraton: 'rejected' }
      })
    )
    expect(() =>
      router.resolve({ model_specific: { prompt: undefined } })
    ).toThrow(
      expect.objectContaining({
        reason: 'validation',
        fieldErrors: { prompt: 'required' }
      })
    )
    expect(defaults).toEqual({ prompt: 'Page example', duration: 10 })
  })

  it('rejects nonfinite numbers and unsupported categorical values instead of silently resetting defaults', () => {
    const fields: FieldSchema[] = [
      select('style', ['realistic', 'anime']),
      {
        kind: 'number',
        name: 'seed',
        label: 'Seed',
        step: 1,
        min: 0,
        max: 100
      }
    ]
    expect(() => mapRouterParameters(fields, {}, { seed: NaN })).toThrow(
      expect.objectContaining({
        reason: 'validation',
        fieldErrors: { seed: 'rejected' }
      })
    )
    expect(() => mapRouterParameters(fields, {}, { style: 'surreal' })).toThrow(
      expect.objectContaining({
        reason: 'validation',
        fieldErrors: { style: 'rejected' }
      })
    )
  })
})

describe('normalized Router media', () => {
  const upload: FieldSchema = {
    kind: 'file',
    name: 'image',
    label: 'Image',
    accept: ['image/png'],
    maxBytes: 1024,
    required: true
  }
  const url: FieldSchema = {
    kind: 'text',
    name: 'image_url',
    label: 'Image URL',
    required: true,
    multiline: false,
    presentation: {
      label: 'Image URL',
      help: '',
      hidden: false,
      advanced: false,
      control: 'text-box',
      imageSource: 'url',
      urlUpload: 'image'
    }
  }

  it('keeps URL controls as strings and gives file controls lazy source URLs', () => {
    const source = 'https://example.com/image.png'
    const values = mapRouterParameters(
      [upload, url],
      {},
      { source_images: [source] }
    )
    expect(values.image_url).toBe(source)
    expect(values.image).toMatchObject({
      sourceUrl: source,
      type: 'image/png',
      size: 0
    })
  })

  it('preserves bytes for both the base64 encoder and temporary URL uploader', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71])
    const values = mapRouterParameters(
      [upload, url],
      {},
      {
        source_images: [
          { data: bytes, mimeType: 'image/png', name: 'input.png' }
        ]
      }
    )
    for (const value of Object.values(values)) {
      if (typeof value !== 'object' || Array.isArray(value) || !value.file)
        throw new Error('Expected a real upload')
      expect(value.file.type).toBe('image/png')
      expect(value.file.name).toBe('input.png')
      expect(new Uint8Array(await value.file.arrayBuffer())).toEqual(bytes)
    }
  })

  it('decodes data URIs and rejects invalid media before network work', async () => {
    const values = mapRouterParameters(
      [url],
      {},
      { source_images: ['data:image/png;base64,iVBORw=='] }
    )
    const value = values.image_url
    if (typeof value !== 'object' || Array.isArray(value) || !value.file)
      throw new Error('Expected decoded file')
    expect(new Uint8Array(await value.file.arrayBuffer())).toEqual(
      new Uint8Array([137, 80, 78, 71])
    )
    expect(() =>
      mapRouterParameters(
        [url],
        {},
        { source_images: ['data:image/png;base64,?'] }
      )
    ).toThrow(
      expect.objectContaining({
        reason: 'validation',
        fieldErrors: { image_url: 'badType' }
      })
    )
    expect(() =>
      mapRouterParameters(
        [upload],
        {},
        {
          source_images: [
            new Blob(['too large'.repeat(200)], { type: 'image/png' })
          ]
        }
      )
    ).toThrow(
      expect.objectContaining({
        reason: 'validation',
        fieldErrors: { image: 'tooLarge' }
      })
    )
    expect(() =>
      mapRouterParameters(
        [upload],
        {},
        { source_images: [new Blob(['audio'], { type: 'audio/mpeg' })] }
      )
    ).toThrow(
      expect.objectContaining({
        reason: 'validation',
        fieldErrors: { image: 'badType' }
      })
    )
  })

  it('keeps source, reference, mask and last-frame inputs separate', () => {
    const fields: FieldSchema[] = [
      'image',
      'reference_image_url',
      'reference_image_url_2',
      'mask',
      'last_frame'
    ].map((name) => ({ ...upload, name }))
    const values = mapRouterParameters(
      fields,
      {},
      {
        source_images: ['https://example.com/source.png'],
        reference_images: [
          'https://example.com/ref1.png',
          'https://example.com/ref2.png'
        ],
        mask_image: 'https://example.com/mask.png',
        last_frame: 'https://example.com/end.png'
      }
    )
    expect(values).toMatchObject({
      image: { sourceUrl: 'https://example.com/source.png' },
      reference_image_url: { sourceUrl: 'https://example.com/ref1.png' },
      reference_image_url_2: { sourceUrl: 'https://example.com/ref2.png' },
      mask: { sourceUrl: 'https://example.com/mask.png' },
      last_frame: { sourceUrl: 'https://example.com/end.png' }
    })
  })
})
