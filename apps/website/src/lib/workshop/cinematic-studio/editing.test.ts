import { describe, expect, it } from 'vitest'

import {
  prepareModelRouterRender,
  resolveModelRouterRender
} from '../../../config/router-render'
import { getAuthoredRouterWorkshopModelDetail } from '../../../config/workshop-router-content'
import { AUTO_DIRECTION } from './catalog'
import {
  cameraViewDefaults,
  cameraViewPrompt,
  cinematicEditingDescriptor,
  cinematicEditingForm,
  cinematicLookPrompt,
  cinematicRelightPrompt,
  runnableCinematicEditingModels
} from './editing'

const slugs = [
  'byteplus--seedream-4-5--edit-images',
  'vertexai--gemini-3-pro-image--edit-images',
  'byteplus--seedream-5-pro--edit-images',
  'vertexai--gemini-nano-banana-2--edit-images'
]

function modelFor(slug: string) {
  const model = getAuthoredRouterWorkshopModelDetail(slug)
  if (!model?.execution) throw new Error(`Missing bundled contract: ${slug}`)
  return model
}

describe('cinematic editing contracts', () => {
  it('does not invent GPT edit bindings absent from the authored catalogue', () => {
    for (const slug of [
      'openai--gpt-image-2--edit-images',
      'openai--gpt-image-2.5-flare--edit-images',
      'openai--gpt-image-2.5-sunburst--edit-images'
    ])
      expect(getAuthoredRouterWorkshopModelDetail(slug)).toBeUndefined()
  })
  it.for([
    'qwen--qwen-image-3.0-image-edit--edit-images',
    'qwen--qwen-image-3.0-pro-image-edit--edit-images'
  ])('prepares all three ordered Qwen references for %s', async (slug) => {
    const model = modelFor(slug)
    expect(cinematicEditingDescriptor(model)).toMatchObject({
      maxReferences: 3,
      aspects: ['3:2', '2:3', '1:1']
    })
    const files = [1, 2, 3].map(
      (n) => new File(['image'], `${n}.png`, { type: 'image/png' })
    )
    const form = cinematicEditingForm(model, {
      sourceFile: files[0],
      sourceFiles: files.slice(1),
      prompt: 'Preserve all three subjects',
      aspect: '3:2',
      seed: 42
    })
    const uploaded: string[] = []
    const prepared = await prepareModelRouterRender(
      model,
      {},
      {
        form,
        uploadFile: async (file) => {
          uploaded.push(file.name)
          return `https://example.com/${file.name}`
        }
      }
    )
    expect(uploaded).toEqual(['1.png', '2.png', '3.png'])
    expect(prepared.body).toMatchObject({
      input: {
        messages: [
          {
            role: 'user',
            content: [
              { image: 'https://example.com/1.png' },
              { image: 'https://example.com/2.png' },
              { image: 'https://example.com/3.png' },
              { text: 'Preserve all three subjects' }
            ]
          }
        ]
      },
      parameters: { size: '1536*1024', seed: 42 }
    })
    expect(() =>
      cinematicEditingForm(model, {
        sourceFile: files[0],
        sourceFiles: files,
        prompt: 'Too many',
        aspect: '1:1'
      })
    ).toThrow('validation')
    expect(() =>
      cinematicEditingForm(model, {
        sourceFile: files[0],
        prompt: 'Bad ratio',
        aspect: '16:9'
      })
    ).toThrow('validation')
  })
  it.for(slugs)(
    'prepares every reference in order and rejects excess for %s',
    async (slug) => {
      const model = modelFor(slug)
      const bytes = Uint8Array.from(
        atob(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII='
        ),
        (char) => char.charCodeAt(0)
      )
      const payloads = [1, 2, 3].map(
        (index) => new Uint8Array([...bytes, index])
      )
      const files = payloads.map(
        (payload, index) =>
          new File([payload], `${index + 1}.png`, { type: 'image/png' })
      )
      const uploads: string[] = []
      const prepared = await prepareModelRouterRender(
        model,
        {},
        {
          form: cinematicEditingForm(model, {
            sourceFile: files[0],
            sourceFiles: files.slice(1),
            prompt: 'Use each reference',
            aspect: '16:9'
          }),
          uploadFile: async (file) => {
            uploads.push(file.name)
            return `https://example.com/${file.name}`
          }
        }
      )
      if (slug.startsWith('byteplus')) {
        expect(uploads).toEqual([])
        expect(prepared.body.image).toEqual(
          payloads.map(
            (payload) =>
              `data:image/png;base64,${btoa(String.fromCharCode(...payload))}`
          )
        )
      } else {
        const contents = prepared.body.contents as { parts: unknown[] }[]
        expect(contents[0].parts).toHaveLength(4)
        expect(contents[0].parts.slice(1)).toEqual(
          payloads.map((payload) => ({
            inlineData: {
              mimeType: 'image/png',
              data: btoa(String.fromCharCode(...payload))
            }
          }))
        )
      }
      const max = slug.startsWith('byteplus') ? 10 : 4
      expect(() =>
        cinematicEditingForm(model, {
          sourceFile: files[0],
          sourceFiles: Array.from({ length: max }, () => files[1]),
          prompt: 'Too many'
        })
      ).toThrow('validation')
    }
  )
  it('lists only runnable bounded image-edit routes', () => {
    expect(
      runnableCinematicEditingModels(getAuthoredRouterWorkshopModelDetail).map(
        (model) => model.slug
      )
    ).toEqual([
      ...slugs,
      'qwen--qwen-image-3.0-image-edit--edit-images',
      'qwen--qwen-image-3.0-pro-image-edit--edit-images'
    ])
    expect(
      runnableCinematicEditingModels((slug) => ({
        ...modelFor(slug),
        execution: undefined
      }))
    ).toEqual([])
    expect(
      cinematicEditingDescriptor(
        modelFor('byteplus--seedream-4-5--generate-images')
      )
    ).toBeUndefined()
  })

  it.for(slugs)(
    'resolves the selected frame without catalogue examples for %s',
    (slug) => {
      const model = modelFor(slug)
      const sourceFile = new File(['frame'], 'selected.png', {
        type: 'image/png'
      })
      const form = cinematicEditingForm(model, {
        sourceFile,
        prompt: 'Relight the selected frame',
        aspect: '16:9',
        resolution: '2K'
      })
      const resolved = resolveModelRouterRender(model, {}, { form })
      expect(resolved.expectedKind).toBe('image')
      expect(resolved.values.prompt).toBe('Relight the selected frame')
      expect(resolved.values.images).toEqual([
        {
          name: sourceFile.name,
          size: sourceFile.size,
          type: sourceFile.type,
          file: sourceFile
        }
      ])
      if (slug.startsWith('byteplus')) {
        expect(resolved.contract.id).toBe(
          slug.includes('5-pro')
            ? 'byteplus/seedream-5-0-pro-260628'
            : 'byteplus/seedream-4-5-251128'
        )
        expect(resolved.values.size).toBe(
          slug.includes('5-pro') ? '1920x1080' : '2560x1440'
        )
      } else {
        expect(resolved.contract.id).toBe(
          slug.includes('nano-banana')
            ? 'vertexai/gemini-3.1-flash-image'
            : 'vertexai/gemini-3-pro-image'
        )
        expect(resolved.values.image_aspectRatio).toBe('16:9')
        expect(resolved.values.image_imageSize).toBe('2K')
      }
    }
  )

  it.for(slugs)('requires a selected image and instruction for %s', (slug) => {
    const model = modelFor(slug)
    expect(() => cinematicEditingForm(model, { prompt: 'Relight' })).toThrow(
      'validation'
    )
    expect(() =>
      cinematicEditingForm(model, {
        prompt: 'Relight',
        sourceFile: new File(['clip'], 'clip.mp4', { type: 'video/mp4' })
      })
    ).toThrow('validation')
    expect(() =>
      cinematicEditingForm(model, {
        prompt: ' ',
        sourceFile: new File(['frame'], 'frame.png', { type: 'image/png' })
      })
    ).toThrow('validation')
  })

  it('derives offered settings from each bundled contract', () => {
    expect(cinematicEditingDescriptor(modelFor(slugs[0]))).toMatchObject({
      aspects: ['21:9', '16:9', '4:3', '3:2', '2:3', '1:1', '9:16'],
      resolutions: []
    })
    expect(cinematicEditingDescriptor(modelFor(slugs[1]))).toMatchObject({
      resolutions: ['1K', '2K', '4K'],
      defaultResolution: '1K'
    })
  })
})

describe('bounded edit instructions', () => {
  it('moves camera perspective while preserving the same scene moment', () => {
    const prompt = cameraViewPrompt({
      ...cameraViewDefaults,
      azimuth: 'right',
      distance: 'close'
    })
    expect(prompt).toContain('right-side profile')
    expect(prompt).toContain('Tight close-up')
    expect(prompt).toContain(
      'Foreground and background should change perspective together'
    )
    expect(() =>
      cameraViewPrompt({ ...cameraViewDefaults, elevation: 'unknown' })
    ).toThrow('validation')
  })

  it('applies selected look treatments without introducing framing instructions', () => {
    const prompt = cinematicLookPrompt({
      ...AUTO_DIRECTION,
      lens: 'anamorphic',
      shot: 'wide'
    })
    expect(prompt).toContain('anamorphic lens')
    expect(prompt).toContain('Preserve its subject identity')
    expect(prompt).not.toContain('wide shot')
    expect(() => cinematicLookPrompt(AUTO_DIRECTION)).toThrow('validation')
    expect(() =>
      cinematicLookPrompt({ ...AUTO_DIRECTION, lens: 'unknown' })
    ).toThrow('validation')
  })

  it('keeps relighting limited to light and shadows', () => {
    expect(cinematicRelightPrompt('golden-hour', 'side')).toContain(
      'low-angle sunlight. Light from the side.'
    )
    expect(cinematicRelightPrompt('moonlight', 'auto')).toContain(
      'Change only the illumination and its corresponding shadows'
    )
    expect(() => cinematicRelightPrompt('unknown', 'side')).toThrow(
      'validation'
    )
    expect(() => cinematicRelightPrompt('moonlight', 'unknown')).toThrow(
      'validation'
    )
  })
})
