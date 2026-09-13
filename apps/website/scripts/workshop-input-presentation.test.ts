import { z } from 'astro/zod'
import { describe, expect, it } from 'vitest'

import packedContracts from '../src/content/workshop-router-contracts.json'
import rawPresentation from '../src/data/workshop-input-presentation.json'
import rawSnapshots from '../src/data/workshop-router-openapi.snapshot.json'
import {
  formForContract,
  workshopContractRecordSchema,
  workshopContractSchema
} from '../src/config/workshop-contract'
import { fieldsForDefinition } from '../src/config/workshop-form-definition'
import { validateWorkshopInput } from '../src/config/workshop-json-schema'
import {
  defaultValues,
  schemaForModel
} from '../src/config/workshop-playground'
import type { FormValues } from '../src/config/workshop-playground'
import { prepareWorkshopRouterInput } from '../src/config/workshop-request'
import { getRouterWorkshopModelDetail } from '../src/config/workshop-router-content'
import { initialWorkshopPageState } from '../src/config/workshop-page-state'
import { prepareModelRouterRender } from '../src/config/router-render'
import {
  parseRouterOpenApiSnapshot,
  routerInputSchema,
  resolveSchemaReference
} from '../src/config/workshop-router-openapi'
import { curateWorkshopInputs } from './workshop-input-presentation'

const object = z.record(z.string(), z.json())
const contracts = packedContracts.map((entry) =>
  workshopContractRecordSchema.parse(entry)
)
const sources = new Map(
  rawSnapshots.map((raw) => {
    const snapshot = parseRouterOpenApiSnapshot(raw)
    return [snapshot.id, snapshot] as const
  })
)

describe('curated model inputs', () => {
  it('submits the selected HeyGen language codes and leaves automatic detection unset', async () => {
    const model = getRouterWorkshopModelDetail('heygen--starfish-tts--audio')
    if (!model) throw new Error('Missing HeyGen page')
    const initial = initialWorkshopPageState(model)
    const language = initial.schema.find((field) => field.name === 'language')
    const locale = initial.schema.find((field) => field.name === 'locale')
    expect(language).toMatchObject({
      kind: 'select',
      options: expect.arrayContaining(['fr'])
    })
    expect(locale).toMatchObject({
      kind: 'select',
      options: expect.arrayContaining(['fr-FR'])
    })
    const automatic = await prepareModelRouterRender(model)
    expect(automatic.body).not.toHaveProperty('language')
    expect(automatic.body).not.toHaveProperty('locale')
    const selected = await prepareModelRouterRender(model, {
      model_specific: { language: 'fr', locale: 'fr-FR' }
    })
    expect(selected.body).toEqual({
      ...automatic.body,
      language: 'fr',
      locale: 'fr-FR'
    })
  })

  it('uploads a replacement BRIA Expand source and maps its stored URL into the request', async () => {
    const model = getRouterWorkshopModelDetail(
      'bria--expand-image--edit-images'
    )
    if (!model) throw new Error('Missing BRIA Expand page')
    const file = new File(['image bytes'], 'replacement.png', {
      type: 'image/png'
    })
    const uploaded: File[] = []
    const prepared = await prepareModelRouterRender(
      model,
      { source_images: [file] },
      {
        uploadFile: async (image) => {
          uploaded.push(image)
          return 'https://storage.example/replacement.png'
        }
      }
    )
    expect(uploaded).toEqual([file])
    expect(prepared.body).toMatchObject({
      image: 'https://storage.example/replacement.png'
    })
  })

  it.for([-1, 0, undefined])(
    'leaves an optional seed unset instead of applying the Router default %s',
    async (seedDefault) => {
      const source = {
        type: 'object',
        properties: {
          prompt: { type: 'string' },
          seed: {
            type: 'integer',
            minimum: -1,
            maximum: 100,
            ...(seedDefault === undefined ? {} : { default: seedDefault })
          }
        },
        required: ['prompt'],
        default: { prompt: 'A cube', seed: seedDefault ?? 42 }
      }
      const original = structuredClone(source)
      const contract = workshopContractSchema.parse({
        id: 'fixture/optional-seed',
        sourceCommit: 'a'.repeat(40),
        ...curateWorkshopInputs('fixture/optional-seed', source),
        output: { format: 'auto', contentTypes: ['application/json'] }
      })
      const schema = schemaForModel({
        fields: [],
        form: formForContract(contract)
      })
      const values: FormValues = { ...defaultValues(schema), prompt: 'A cube' }
      const prepare = (seedValues = values) =>
        prepareWorkshopRouterInput(
          contract,
          seedValues,
          new AbortController().signal
        )
      expect(await prepare()).toEqual({ prompt: 'A cube' })
      expect(contract.inputSchema.default).toEqual({ prompt: 'A cube' })
      for (const seed of [-1, 0, 100])
        expect(await prepare({ ...values, seed })).toEqual({
          prompt: 'A cube',
          seed
        })
      for (const seed of [-2, 0.5, 101])
        await expect(prepare({ ...values, seed })).rejects.toMatchObject({
          reason: 'validation'
        })
      expect(await prepare({ ...values, seed: undefined })).not.toHaveProperty(
        'seed'
      )
      expect(source).toEqual(original)
    }
  )

  it.for([0, undefined])(
    'keeps a valid required seed and rejects clearing it (Router default %s)',
    async (seedDefault) => {
      const contract = workshopContractSchema.parse({
        id: 'fixture/required-seed',
        sourceCommit: 'a'.repeat(40),
        ...curateWorkshopInputs('fixture/required-seed', {
          type: 'object',
          properties: {
            seed: {
              type: 'integer',
              minimum: 0,
              maximum: 100,
              ...(seedDefault === undefined ? {} : { default: seedDefault })
            }
          },
          required: ['seed']
        }),
        output: { format: 'auto', contentTypes: ['application/json'] }
      })
      const schema = schemaForModel({
        fields: [],
        form: formForContract(contract)
      })
      const values = defaultValues(schema)
      expect(
        await prepareWorkshopRouterInput(
          contract,
          values,
          new AbortController().signal
        )
      ).toEqual({ seed: seedDefault ?? 42 })
      await expect(
        prepareWorkshopRouterInput(
          contract,
          { seed: undefined },
          new AbortController().signal
        )
      ).rejects.toMatchObject({ fieldErrors: { seed: 'rejected' } })
    }
  )

  it('sends one output without a widget, even when the provider defaults to four', async () => {
    const source = {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        n: { type: 'integer', minimum: 1, maximum: 4, default: 4 }
      },
      required: ['prompt', 'n'],
      example: { prompt: 'A cube', n: 4 },
      additionalProperties: false
    }
    const original = structuredClone(source)
    const curated = curateWorkshopInputs('fixture/output-count', source)
    const contract = workshopContractSchema.parse({
      id: 'fixture/output-count',
      sourceCommit: 'a'.repeat(40),
      ...curated,
      output: { format: 'auto', contentTypes: ['application/json'] }
    })
    expect(
      fieldsForDefinition(formForContract(contract)).map((field) => field.name)
    ).toEqual(['prompt'])
    expect(
      await prepareWorkshopRouterInput(
        contract,
        { prompt: 'A cube' },
        new AbortController().signal
      )
    ).toEqual({ prompt: 'A cube', n: 1 })
    expect(curated.inputSchema.example).toEqual({ prompt: 'A cube', n: 1 })
    expect(source).toEqual(original)
    await expect(
      prepareWorkshopRouterInput(
        contract,
        { prompt: 'A cube', n: 4 },
        new AbortController().signal
      )
    ).rejects.toMatchObject({ reason: 'validation' })
    await expect(
      prepareWorkshopRouterInput(
        contract,
        { request_body: JSON.stringify({ prompt: 'A cube', n: 4 }) },
        new AbortController().signal
      )
    ).rejects.toMatchObject({ reason: 'validation' })
    expect(() =>
      curateWorkshopInputs('fixture/invalid-count', {
        properties: { n: { type: 'integer', minimum: 2, maximum: 4 } }
      })
    ).toThrow('Invalid fixed input')
  })

  it('offers no output-count controls across the generated Router contracts', () => {
    const outputCountNames =
      /^(?:param_)?(?:n|count|num_images|sampleCount|series_amount)$/
    const controls = contracts.flatMap((contract) =>
      fieldsForDefinition(formForContract(contract))
        .filter((field) => outputCountNames.test(field.name))
        .map((field) => `${contract.id}:${field.name}`)
    )
    expect(controls).toEqual([])
  })

  it('applies every model-specific widget to an authored Router schema', () => {
    for (const [id, rules] of Object.entries(rawPresentation.models)) {
      const snapshot = sources.get(id)
      if (!snapshot?.document['x-comfy-input-schema-authored'])
        throw new Error(`Widget definitions have no Router schema: ${id}`)
      const { inputs } = curateWorkshopInputs(id, routerInputSchema(snapshot))
      for (const [name, rule] of Object.entries(rules)) {
        const input = inputs[name]
        expect(input, `${id}:${name}`).toBeDefined()
        const presentation = object.parse(rule)
        for (const key of ['label', 'help', 'hidden', 'advanced', 'unit'])
          if (Object.hasOwn(presentation, key))
            expect(input, `${id}:${name}`).toHaveProperty(
              key,
              presentation[key]
            )
      }
    }
  })

  it('hides undefined optional widgets, keeps their defaults and shows undefined required inputs minimally', async () => {
    const source = {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        requiredCaption: {
          type: 'string',
          description: 'Verbose upstream explanation. '.repeat(100)
        },
        providerOption: { type: 'integer', default: 0 },
        providerSwitch: { type: 'boolean', default: false },
        providerExtra: { type: 'string' }
      },
      required: ['prompt', 'requiredCaption']
    }
    const curated = curateWorkshopInputs('fixture/allowlist', source)
    const contract = workshopContractSchema.parse({
      id: 'fixture/allowlist',
      sourceCommit: 'a'.repeat(40),
      ...curated,
      output: { format: 'auto', contentTypes: ['application/json'] }
    })
    const fields = fieldsForDefinition(formForContract(contract))
    expect(fields.map((field) => field.name)).toEqual([
      'prompt',
      'requiredCaption'
    ])
    expect(fields[1]).toMatchObject({
      label: 'Required Caption',
      required: true,
      hint: ''
    })
    expect(JSON.stringify(fields.map((field) => field.hint))).not.toContain(
      'Verbose upstream'
    )
    expect(
      await prepareWorkshopRouterInput(
        contract,
        { prompt: 'A cube', requiredCaption: 'Hello' },
        new AbortController().signal
      )
    ).toEqual({
      prompt: 'A cube',
      requiredCaption: 'Hello',
      providerOption: 0,
      providerSwitch: false
    })
    await expect(
      prepareWorkshopRouterInput(
        contract,
        { prompt: 'A cube' },
        new AbortController().signal
      )
    ).rejects.toMatchObject({ reason: 'validation' })
    await expect(
      prepareWorkshopRouterInput(
        contract,
        { prompt: 'A cube', requiredCaption: 'Hello', providerOption: 42 },
        new AbortController().signal
      )
    ).rejects.toMatchObject({ reason: 'validation' })
  })

  it('uses common presentation while preserving wire names, types, defaults and precision', async () => {
    const curated = curateWorkshopInputs('fixture/image', {
      type: 'object',
      properties: {
        text_prompt: { type: 'string', minLength: 2 },
        seed: { type: 'integer', minimum: -1, maximum: 100, default: 0 },
        width: { type: 'integer', minimum: 256, maximum: 2048, multipleOf: 64 },
        creativity: { type: 'number', minimum: 0, maximum: 1, default: 0.125 },
        guidance: { type: 'number' },
        generate_audio: { type: 'boolean', default: false },
        voice_id: { type: 'string' },
        style_id: { type: 'string' }
      },
      required: ['text_prompt']
    })
    const contract = workshopContractSchema.parse({
      id: 'fixture/image',
      sourceCommit: 'a'.repeat(40),
      ...curated,
      advancedFields: Object.entries(curated.inputs)
        .filter(([, input]) => input.advanced)
        .map(([name]) => name),
      output: { format: 'auto', contentTypes: ['application/json'] }
    })
    const schema = schemaForModel({
      fields: [],
      form: formForContract(contract)
    })
    const fields = new Map(schema.map((field) => [field.name, field]))
    expect(fields.get('text_prompt')).toMatchObject({
      label: 'Prompt',
      multiline: true,
      required: true,
      advanced: false
    })
    expect(fields.get('creativity')).toMatchObject({
      kind: 'number',
      step: 'any',
      defaultValue: 0.125,
      presentation: { control: 'slider', defaultSource: 'router' }
    })
    expect(fields.get('width')).toMatchObject({
      step: 64,
      defaultValue: 1024,
      presentation: { control: 'slider', defaultSource: 'curated' }
    })
    expect(fields.get('guidance')).toMatchObject({
      presentation: { control: 'number' }
    })
    const values = defaultValues(schema)
    expect(values.voice_id).toBeUndefined()
    expect(values.style_id).toBeUndefined()
    const body = await prepareWorkshopRouterInput(
      contract,
      { ...values, text_prompt: 'A red cube', creativity: 0.333, seed: 0 },
      new AbortController().signal
    )
    expect(body).toEqual({
      text_prompt: 'A red cube',
      seed: 0,
      width: 1024,
      creativity: 0.333,
      guidance: 3.5,
      generate_audio: false
    })
    expect(body).not.toHaveProperty('prompt')
  })

  it('fails generation on unsafe defaults, required hidden fields and stale omissions', () => {
    expect(() =>
      curateWorkshopInputs('fixture/image', {
        properties: { width: { type: 'integer', minimum: 512, default: 0 } }
      })
    ).toThrow('Invalid Router default')
    expect(() =>
      curateWorkshopInputs('fixture/image', {
        properties: { callback_url: { type: 'string' } },
        required: ['callback_url']
      })
    ).toThrow('Cannot hide required')
    expect(() =>
      curateWorkshopInputs('fixture/image', { properties: {} }, ['missing'])
    ).toThrow('Unknown curated input')
  })

  it('removes operational settings from examples and defaults without mutating the source', () => {
    const source = {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        callback_url: { type: 'string' }
      },
      example: {
        prompt: 'A cube',
        callback_url: 'https://example.com/callback'
      },
      default: { callback_url: 'https://example.com/callback' },
      not: { required: ['forbidden'] }
    }
    const original = structuredClone(source)
    const { inputSchema, inputs } = curateWorkshopInputs(
      'fixture/image',
      source
    )
    expect(source).toEqual(original)
    expect(inputSchema.example).toEqual({ prompt: 'A cube' })
    expect(inputSchema.default).toEqual({})
    expect(inputs.callback_url.hidden).toBe(true)
    expect(validateWorkshopInput({ prompt: 'A cube' }, inputSchema)).toBe(true)
    expect(
      validateWorkshopInput({ prompt: 'A cube', callback_url: '' }, inputSchema)
    ).toBe(false)
    expect(
      validateWorkshopInput({ prompt: 'A cube', forbidden: true }, inputSchema)
    ).toBe(false)
  })

  it('limits Seedance 2.0 Fast to supported resolution and numeric duration choices', async () => {
    const contract = contracts.find(
      (entry) => entry.id === 'byteplus/dreamina-seedance-2-0-fast-260128'
    )
    if (!contract) throw new Error('Missing Seedance contract')
    const fields = new Map(
      fieldsForDefinition(formForContract(contract)).map((field) => [
        field.name,
        field
      ])
    )
    expect(fields.get('duration')).toMatchObject({
      kind: 'select',
      label: 'Duration',
      default: 5,
      advanced: false,
      options: [-1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
    })
    expect(fields.get('resolution')).toMatchObject({
      options: ['480p', '720p'],
      default: '720p',
      advanced: false
    })
    expect(fields.has('callback_url')).toBe(false)
    expect(fields.has('model')).toBe(false)
    const example = object.parse(contract.inputSchema.example)
    for (const change of [
      { duration: '5' },
      { duration: 3 },
      { duration: 16 },
      { resolution: '1080p' },
      { resolution: '4k' },
      { callback_url: 'https://example.com' }
    ]) {
      await expect(
        prepareWorkshopRouterInput(
          contract,
          { request_body: JSON.stringify({ ...example, ...change }) },
          new AbortController().signal
        )
      ).rejects.toMatchObject({ reason: 'validation' })
    }
    const body = { ...example, duration: 6, resolution: '720p' }
    expect(
      await prepareWorkshopRouterInput(
        contract,
        { request_body: JSON.stringify(body) },
        new AbortController().signal
      )
    ).toEqual(body)
  })

  it.for([
    {
      id: 'luma/ray-2',
      values: { prompt: 'A red cube', duration: '9s' },
      expected: { duration: '9s', generation_type: 'video' },
      absent: []
    },
    {
      id: 'fal/h3-max',
      values: { prompt: 'A slow camera pan' },
      expected: {
        prompt_expansion_mode: 'balanced',
        resolution: '768P',
        duration: 5
      },
      absent: []
    },
    {
      id: 'bria/video-edit-remove-background',
      values: { video: 'https://example.invalid/input.mp4' },
      expected: {
        background_color: 'Transparent',
        output_container_and_codec: 'webm_vp9'
      },
      absent: []
    },
    {
      id: 'ideogram/ideogram-v4',
      values: { prompt: 'A red cube' },
      expected: { rendering_speed: 'DEFAULT' },
      absent: ['resolution']
    },
    {
      id: 'openai/o3',
      values: { input: JSON.stringify('Describe a red cube') },
      expected: { input: 'Describe a red cube' },
      absent: ['temperature', 'top_p']
    },
    {
      id: 'heygen/starfish',
      values: { text: 'Hello', voice_id: 'creator-voice' },
      expected: { input_type: 'text', voice_id: 'creator-voice' },
      absent: ['language', 'locale']
    },
    {
      id: 'kling/kling-v3',
      values: { prompt: 'A slow camera pan' },
      expected: { prompt: 'A slow camera pan' },
      absent: ['multi_shot', 'shot_type', 'multi_prompt']
    },
    {
      id: 'recraft/recraftv4',
      values: { prompt: 'A red cube', style_id: 'creator-style' },
      expected: { style_id: 'creator-style' },
      absent: ['style']
    },
    {
      id: 'bfl/flux-pro-1.0-canny',
      values: {
        prompt: 'A red cube',
        canny_high_threshold: 250,
        guidance: 30.125
      },
      expected: {
        canny_high_threshold: 250,
        guidance: 30.125,
        prompt_upsampling: false
      },
      absent: ['seed']
    }
  ])(
    'prepares meaningful defaults and native widget values for $id',
    async ({ id, values, expected, absent }) => {
      const contract = contracts.find((entry) => entry.id === id)
      if (!contract) throw new Error(`Missing contract: ${id}`)
      const schema = schemaForModel({
        fields: [],
        form: formForContract(contract)
      })
      const body = await prepareWorkshopRouterInput(
        contract,
        { ...defaultValues(schema), ...values },
        new AbortController().signal
      )
      expect(body).toMatchObject(expected)
      for (const name of absent) expect(body).not.toHaveProperty(name)
    }
  )

  it.for(contracts)(
    'keeps defaults and choices native-valid and hidden inputs unsubmitable: $id',
    async (contract) => {
      const snapshot = sources.get(contract.id)
      if (!snapshot) throw new Error('Missing source')
      const source = routerInputSchema(snapshot)
      if (!contract.inputs)
        throw new Error('Missing curated widget definitions')
      const properties = object.parse(source.properties ?? {})
      const effectiveProperties = object.parse(
        contract.inputSchema.properties ?? {}
      )
      const fields = new Set(
        fieldsForDefinition(formForContract(contract)).map(
          (field) => field.name
        )
      )
      for (const [name, input] of Object.entries(contract.inputs)) {
        const schema = object.parse({
          ...resolveSchemaReference(object.parse(properties[name]), source),
          ...(source.components ? { components: source.components } : {})
        })
        if (input.hidden) {
          expect(fields.has(name)).toBe(false)
          if (Object.hasOwn(contract.defaultInput ?? {}, name)) {
            const fixed = contract.defaultInput?.[name]
            expect(effectiveProperties[name]).toMatchObject({ const: fixed })
            expect(validateWorkshopInput(fixed, schema)).toBe(true)
          } else expect(effectiveProperties).not.toHaveProperty(name)
          await expect(
            prepareWorkshopRouterInput(
              contract,
              { [name]: 'unwanted' },
              new AbortController().signal
            )
          ).rejects.toMatchObject({ reason: 'validation' })
          const body = {
            ...object.parse(contract.inputSchema.example ?? {}),
            [name]: 'unwanted'
          }
          await expect(
            prepareWorkshopRouterInput(
              contract,
              { request_body: JSON.stringify(body) },
              new AbortController().signal
            )
          ).rejects.toMatchObject({ reason: 'validation' })
        } else {
          const effective = object.parse(effectiveProperties[name])
          if (input.defaultSource) {
            expect(validateWorkshopInput(effective.default, schema)).toBe(true)
            if (input.defaultSource === 'router')
              expect(effective.default).toEqual(schema.default)
          }
          if (Array.isArray(effective.enum))
            for (const option of effective.enum)
              expect(validateWorkshopInput(option, schema)).toBe(true)
        }
      }
    }
  )
})
