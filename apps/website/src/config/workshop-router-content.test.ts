import { describe, expect, it } from 'vitest'

import { workshopModels } from './models-catalogue'
import { deriveWorkshopFields } from './workshop-fields'
import { getRouterWorkshopModelDetail } from './workshop-router-content'
import {
  defaultValues,
  groupPlaygroundFields,
  schemaForModel,
  validateForm
} from './workshop-playground'
import { prepareWorkshopRouterInput } from './workshop-request'
import {
  routerContentById,
  routerContentBySlug
} from './workshop-browse-content'
import {
  fieldsForDefinition,
  usesRequestBodyEditor
} from './workshop-form-definition'
import { resolveSchemaReference } from './workshop-router-openapi'
import { formForContract } from './workshop-contract'
import { workshopContract } from './workshop-contract-catalog'
import { validateWorkshopInput } from './workshop-json-schema'

describe('Router catalog form projection', () => {
  it.for([
    'byteplus/seed-2-0-lite-260228',
    'byteplus/seed-2-0-mini-260215',
    'byteplus/seed-2-0-pro-260328',
    'gemini-interactions/gemini-omni-1.1-flash',
    'gemini-interactions/gemini-omni-flash-preview',
    'ideogram/ideogram-v3',
    'ltx/ltx-2-5-fast',
    'ltx/ltx-2-5-pro'
  ])(
    'builds a valid request from normal controls for the newly authored %s',
    async (id) => {
      const contract = workshopContract(id)
      if (!contract) throw new Error('Missing refreshed contract')
      const form = formForContract(contract)
      expect(usesRequestBodyEditor(form)).toBe(false)
      const schema = schemaForModel({ fields: [], form })
      expect(
        schema.some(
          (field) => field.kind === 'text' && field.valueType === 'json'
        )
      ).toBe(false)
      const prompt = schema.find((field) => field.label === 'Prompt')
      if (!prompt) throw new Error('Missing prompt control')
      expect(prompt).toMatchObject({
        kind: 'text',
        multiline: true,
        required: true
      })
      const values = {
        ...defaultValues(schema),
        [prompt.name]: 'A red teapot on a wooden table.'
      }
      expect(validateForm(schema, values)).toEqual({})
      const body = await prepareWorkshopRouterInput(
        contract,
        values,
        new AbortController().signal
      )
      expect(body[prompt.name]).toBe(values[prompt.name])
      expect(validateWorkshopInput(body, contract.inputSchema)).toBe(true)
      expect(body).not.toHaveProperty('model')
      expect(body).not.toHaveProperty('seed')
      if (id === 'ideogram/ideogram-v3') {
        expect(body).toMatchObject({
          aspect_ratio: '1x1',
          rendering_speed: 'DEFAULT',
          num_images: 1
        })
        expect(body).not.toHaveProperty('resolution')
        expect(
          schema.find((field) => field.name === 'rendering_speed')
        ).toMatchObject({ kind: 'select', advanced: true })
        expect(
          validateWorkshopInput(
            { ...body, style_reference_images: ['image.png'] },
            contract.inputSchema
          )
        ).toBe(false)
      }
      if (id.startsWith('ltx/')) {
        const resolution = schema.find((field) => field.name === 'resolution')
        expect(resolution).toMatchObject({ kind: 'select' })
        expect(body.resolution).toBe('1280x720')
        if (id.endsWith('-pro')) {
          expect(
            validateForm(schema, { ...values, resolution: '3840x2160' })
          ).not.toEqual({})
          expect(
            validateWorkshopInput(
              { ...body, resolution: '3840x2160' },
              contract.inputSchema
            )
          ).toBe(false)
        }
      }
    }
  )

  it.for([
    'gemini-interactions/gemini-omni-1.1-flash',
    'gemini-interactions/gemini-omni-flash-preview',
    'ideogram/ideogram-v3'
  ])('enables the previously incomplete %s with a seeded prompt', (id) => {
    const pages = workshopModels.filter((model) => model.routerId === id)
    expect(pages.length).toBeGreaterThan(0)
    for (const page of pages) {
      const detail = getRouterWorkshopModelDetail(page.slug)
      if (!detail) throw new Error('Missing enabled page')
      expect(detail.incompleteReason).toBeUndefined()
      expect(detail.execution?.id).toBe(id)
      const schema = schemaForModel(detail)
      const prompt = schema.find((field) => field.label === 'Prompt')
      if (!prompt) throw new Error('Missing prompt')
      const values = defaultValues(schema, detail.defaults)
      expect(String(values[prompt.name]).trim().length).toBeGreaterThan(0)
      expect(validateForm([prompt], values)).toEqual({})
    }
  })
  it('keeps use-case URLs and examples separate while sharing the Router contract', () => {
    const create = getRouterWorkshopModelDetail(
      'byteplus--seedream-4-5--generate-images'
    )
    const edit = getRouterWorkshopModelDetail(
      'byteplus--seedream-4-5--edit-images'
    )
    if (!create || !edit) throw new Error('Missing use-case record')
    expect(create.routerId).toBe(edit.routerId)
    expect(create.execution?.inputSchema).toEqual(edit.execution?.inputSchema)
    expect(create.href).not.toBe(edit.href)
    expect(create.useCases).toEqual(['generate-images'])
    expect(edit.useCases).toEqual(['edit-images'])
    expect(edit.examples).toEqual([])
    expect(create.examples).not.toEqual([])
    expect(
      create.examples.every((example) => example.name.startsWith(create.slug))
    ).toBe(true)
    expect(getRouterWorkshopModelDetail('byteplus--seedream-4-5')).toBe(create)
    for (const model of [create, edit])
      expect(routerContentBySlug.get(model.slug)?.overlay.slug).toBe(model.slug)
  })

  it("starts a native request with Rob's prompt without importing legacy settings", async () => {
    const model = getRouterWorkshopModelDetail('bfl--flux-3-video')
    if (!model?.execution) throw new Error('Missing model')
    const prompt = routerContentById
      .get(model.routerId)
      ?.filter(({ alias }) => !alias.contentIssue)
      .flatMap(({ overlay }) => overlay.examples)
      .map((example) => example.values.prompt)
      .find((value) => typeof value === 'string' && value.trim())
    expect(typeof prompt).toBe('string')
    const body = await prepareWorkshopRouterInput(
      model.execution,
      defaultValues(schemaForModel(model), model.defaults),
      new AbortController().signal
    )
    expect(body.prompt).toBe(prompt)
    expect(body.mode).toBe('t2v')
    expect(body).not.toHaveProperty('keyframes')
    expect(body).not.toHaveProperty('start_video')
  })

  it("seeds Seedance's structured prompt without importing sample media", async () => {
    const model = getRouterWorkshopModelDetail(
      'byteplus--dreamina-seedance-2-0-fast-260128'
    )
    if (!model?.execution) throw new Error('Missing model')
    const body = await prepareWorkshopRouterInput(
      model.execution,
      defaultValues(schemaForModel(model), model.defaults),
      new AbortController().signal
    )
    expect(body.content).toEqual([{ type: 'text', text: expect.any(String) }])
    expect(JSON.stringify(body.content)).not.toContain('image_url')
    expect(body.duration).toBe(5)
    expect(body).not.toHaveProperty('callback_url')
  })

  it('starts every visible plain prompt with schema-valid text', () => {
    for (const entry of workshopModels) {
      const model = getRouterWorkshopModelDetail(entry.slug)
      if (!model) throw new Error('Missing model')
      const schema = schemaForModel(model)
      const values = defaultValues(schema, model.defaults)
      for (const field of schema) {
        if (
          field.kind !== 'text' ||
          field.valueType === 'json' ||
          ![
            'prompt',
            'Prompt',
            'promptText',
            'text_prompt',
            'prompt_text',
            'text',
            'input'
          ].includes(field.name)
        )
          continue
        expect(values[field.name]).toEqual(expect.any(String))
        expect(String(values[field.name]).trim()).not.toBe('')
        expect(validateForm([field], values)).toEqual({})
      }
    }
  })

  it.for(workshopModels)(
    'preserves native input types and constraints with curated presentation on $routerId',
    (model) => {
      const detail = getRouterWorkshopModelDetail(model.slug)
      expect(detail).toBeDefined()
      if (!detail) throw new Error('Missing model detail')
      if (!detail.form) throw new Error('Missing form definition')
      const fields = fieldsForDefinition(detail.form)
      const schema = schemaForModel(detail)
      const groups = groupPlaygroundFields(schema)
      const visible = [
        ...groups.primary,
        ...groups.settings,
        ...groups.advanced
      ]
      expect(visible.map((field) => field.name).sort()).toEqual(
        schema.map((field) => field.name).sort()
      )
      expect(new Set(visible.map((field) => field.name)).size).toBe(
        schema.length
      )
      const form = detail.form
      const properties = form.parameters.properties
      if (usesRequestBodyEditor(detail.form)) {
        expect(fields[0].name).toBe('request_body')
        return
      }
      if (
        !properties ||
        typeof properties !== 'object' ||
        Array.isArray(properties)
      )
        throw new Error('Missing properties')
      for (const field of schema.filter((field) => field.kind !== 'file')) {
        const property = properties[field.name]
        if (
          !property ||
          typeof property !== 'object' ||
          Array.isArray(property)
        )
          throw new Error('Missing property')
        expect(field.inputSchema).toMatchObject(
          resolveSchemaReference(property, detail.form.parameters)
        )
      }
      for (const field of deriveWorkshopFields(
        {
          ...form.parameters,
          properties: Object.fromEntries(
            Object.entries(properties).map(([name, value]) => [
              name,
              value && typeof value === 'object' && !Array.isArray(value)
                ? resolveSchemaReference(value, form.parameters)
                : value
            ])
          )
        },
        form.roles,
        detail.execution ? [] : undefined
      )) {
        const actual = fields.find((candidate) => candidate.name === field.name)
        const input = form.inputs?.[field.name]
        if (input?.hidden) {
          expect(actual).toBeUndefined()
          continue
        }
        expect(actual).toMatchObject({
          ...field,
          kind: field.kind === 'media' ? 'file' : field.kind,
          ...(input ? { label: input.label, hint: input.help } : {}),
          ...(field.kind === 'text' && field.valueType === 'string' && input
            ? { multiline: input.control === 'text-area' }
            : {})
        })
        if (field.kind !== 'media') {
          expect(
            actual && 'default' in actual ? actual.default : undefined
          ).toEqual(field.defaultValue)
        }
      }
    }
  )
})
