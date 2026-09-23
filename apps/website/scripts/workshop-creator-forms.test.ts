import { z } from 'astro/zod'
import { describe, expect, it } from 'vitest'

import { workshopContract } from '../src/config/workshop-contract-catalog'
import { schemaAt } from './workshop-creator-fields'
import { creatorFormFor } from './workshop-creator-forms'
import { curateWorkshopInputs } from './workshop-input-presentation'

const object = z.record(z.string(), z.json())

describe('creator schema refresh guards', () => {
  it.for(['sampleCount', 'resolution', 'aspectRatio', 'durationSeconds'])(
    'identifies the model and dropped Veo parameter %s',
    (name) => {
      const id = 'veo/veo-3.1-generate-001'
      const contract = workshopContract(id)
      if (!contract) throw new Error('Missing Veo fixture')
      const schema = contract.inputSchema
      const parameters = schemaAt(schema, 'parameters')
      const fields = object.parse(parameters.properties)
      delete fields[name]
      const changed = {
        ...schema,
        properties: {
          ...object.parse(schema.properties),
          parameters: { ...parameters, properties: fields }
        }
      }
      expect(() =>
        creatorFormFor(id, curateWorkshopInputs(id, changed))
      ).toThrow(`Missing creator parameter ${id}:parameters.${name}`)
    }
  )

  it('validates merged per-content options, including truthy string booleans', () => {
    const id = 'byteplus/dreamina-seedance-2-0-fast-260128'
    const contract = workshopContract(id)
    if (!contract) throw new Error('Missing Seedance fixture')
    const curated = {
      inputSchema: contract.inputSchema,
      inputs: contract.inputs ?? {},
      defaultInput: contract.defaultInput ?? {}
    }
    expect(() => creatorFormFor(id, curated, { urlMedia: 'false' })).toThrow()
  })
})

describe('sibling page modes', () => {
  function curatedFor(id: string) {
    const contract = workshopContract(id)
    if (!contract) throw new Error(`Missing fixture ${id}`)
    return {
      inputSchema: contract.inputSchema,
      inputs: contract.inputs ?? {},
      defaultInput: contract.defaultInput ?? {}
    }
  }
  function formFor(id: string, options: z.infer<typeof object>) {
    const form = creatorFormFor(id, curatedFor(id), options)
    if (!form) throw new Error(`Missing creator form for ${id}`)
    return form
  }
  function files(id: string, options: z.infer<typeof object>) {
    return formFor(id, options).files.map(
      (file) => `${file.name}${file.required ? '*' : ''}`
    )
  }

  it.for([
    'byteplus/seedream-4-0-250828',
    'byteplus/seedream-4-5-251128',
    'byteplus/seedream-5-0-260128',
    'byteplus/seedream-5-0-pro-260628',
    'vertexai/gemini-2.5-flash-image',
    'vertexai/gemini-3-pro-image',
    'vertexai/gemini-3.1-flash-image'
  ])(
    'hides the image slot on the generate page and requires it on the edit page for %s',
    (id) => {
      expect(files(id, { mode: 'generate' })).toEqual([])
      expect(files(id, { mode: 'edit' })).toEqual(['images*'])
      expect(files(id, {})).toEqual(['images'])
      expect(() => formFor(id, { mode: 'reference' })).toThrow()
    }
  )

  it('Seedance 2.5 edit page requires a source video and offers no frame or reference slots', () => {
    const form = formFor('byteplus/dreamina-seedance-2-5-260628', {
      mode: 'edit',
      urlMedia: true
    })
    expect(form.parameters.required).toEqual(
      expect.arrayContaining(['prompt', 'video_url'])
    )
    expect(form.inputs.video_url.urlUpload).toBe('video')
    expect(form.inputs).not.toHaveProperty('first_frame_url')
    expect(form.inputs).not.toHaveProperty('last_frame_url')
    expect(form.inputs).not.toHaveProperty('reference_image_url')
    expect(form.inputs).not.toHaveProperty('duration')
    expect(form.inputs).not.toHaveProperty('ratio')
  })

  it('keeps unsupported GPT Image edit media out of Router forms', () => {
    const id = 'openai/gpt-image-2'
    expect(files(id, {})).toEqual([])
    expect(files(id, { mode: 'generate' })).toEqual([])
    expect(() => formFor(id, { mode: 'edit' })).toThrow()
  })

  it('gives Veo a text page without frames and an animate page that requires the first frame', () => {
    const id = 'veo/veo-3.1-generate-001'
    expect(files(id, { mode: 'text' })).toEqual([])
    expect(files(id, { mode: 'image' })).toEqual(['first_frame*', 'last_frame'])
    expect(files(id, {})).toEqual([
      'first_frame',
      'last_frame',
      'reference_images'
    ])
  })

  it('only offers Seedream layer decomposition on a page with source images', () => {
    const id = 'byteplus/seedream-5-0-pro-260628'
    const generate = object.parse(
      object.parse(formFor(id, { mode: 'generate' }).parameters).properties
    )
    const edit = object.parse(
      object.parse(formFor(id, { mode: 'edit' }).parameters).properties
    )
    expect(generate).not.toHaveProperty('layer_decomposition')
    expect(edit).toHaveProperty('layer_decomposition')
  })

  it.for(['xai/grok-imagine-video', 'xai/grok-imagine-video-1.5'])(
    'gives Grok a text page without the first-frame URL for %s',
    (id) => {
      const text = object.parse(formFor(id, { mode: 'text' }).parameters)
      expect(object.parse(text.properties)).not.toHaveProperty('image_url')
      const image = object.parse(formFor(id, { mode: 'image' }).parameters)
      expect(object.parse(image.properties)).toHaveProperty('image_url')
      expect(image.required).toContain('image_url')
    }
  )
})
