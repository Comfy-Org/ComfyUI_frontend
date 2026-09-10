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
import { routerContentById } from './workshop-browse-content'
import {
  fieldsForDefinition,
  usesRequestBodyEditor
} from './workshop-form-definition'
import { resolveSchemaReference } from './workshop-router-openapi'

describe('Router catalog form projection', () => {
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
            'text'
          ].includes(field.name)
        )
          continue
        expect(values[field.name]).toEqual(expect.any(String))
        expect(String(values[field.name]).trim()).not.toBe('')
        expect(validateForm([field], values)).toEqual({})
      }
    }
  })

  it.for(workshopModels.filter((model) => !model.incompleteReason))(
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
