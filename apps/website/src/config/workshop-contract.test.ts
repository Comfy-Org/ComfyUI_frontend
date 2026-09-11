import { z } from 'astro/zod'
import { describe, expect, it } from 'vitest'

import {
  compileWorkshopContracts,
  countPackedRecords
} from '../../scripts/generate-workshop-router-contracts'
import packedContracts from '../content/workshop-router-contracts.json'
import rawSnapshots from '../data/workshop-router-openapi.snapshot.json'
import rawBindings from '../data/workshop-router-bindings.json'
import { workshopModels } from './models-catalogue'
import { routerContentBySlug } from './workshop-browse-content'
import {
  formForContract,
  workshopContractRecordSchema,
  workshopContractSchema
} from './workshop-contract'
import {
  fieldsForDefinition,
  usesRequestBodyEditor
} from './workshop-form-definition'
import { validateWorkshopInput } from './workshop-json-schema'
import type { FormValues } from './workshop-playground'
import { prepareWorkshopRouterInput } from './workshop-request'
import { parseRouterResponse, releaseRouterOutputs } from './workshop-response'
import { getRouterWorkshopModelDetail } from './workshop-router-content'
import { parseRouterOpenApiSnapshot } from './workshop-router-openapi'

const contracts = packedContracts.map((entry) =>
  workshopContractRecordSchema.parse(entry)
)
const snapshots = rawSnapshots.map(parseRouterOpenApiSnapshot)
const object = z.record(z.string(), z.json())

function exampleValues(contract: (typeof contracts)[number]): FormValues {
  const example = object.parse(contract.inputSchema.example)
  const definition = formForContract(contract)
  if (contract.creator || usesRequestBodyEditor(definition))
    return { request_body: JSON.stringify(example) }
  const fields = new Map(
    fieldsForDefinition(definition).map((field) => [field.name, field])
  )
  return Object.fromEntries(
    Object.entries(example)
      .filter(([name]) => !contract.inputs?.[name]?.hidden)
      .map(([name, value]) => {
        const binding = contract.media.find((media) =>
          media.targets.includes(`/${name}`)
        )
        if (binding) {
          expect(binding).toMatchObject({ encoding: 'base64', accept: 'image' })
          if (typeof value !== 'string')
            throw new Error('Expected Base64 fixture')
          const file = new File([Buffer.from(value, 'base64')], `${name}.png`, {
            type: 'image/png'
          })
          return [
            binding.name,
            { file, name: file.name, size: file.size, type: file.type }
          ]
        }
        const field = fields.get(name)
        if (!field)
          throw new Error(`Example has no form field: ${contract.id}:${name}`)
        if (field.kind === 'text' && field.valueType === 'json')
          return [name, JSON.stringify(value)]
        if (value === null || typeof value === 'object')
          throw new Error(`Example needs JSON control: ${contract.id}:${name}`)
        return [name, value]
      })
  )
}

describe('schema-driven Router coverage', () => {
  it('counts generated records from the JSON array boundary', () => {
    expect(countPackedRecords('[\n\n]\n')).toBe(0)
    expect(countPackedRecords('[\n{"id":1},\n{"id":2}\n]\n')).toBe(2)
    expect(() => countPackedRecords('{"id":1}\n')).toThrow()
  })

  it.for(['not-a-pointer', '/bad~escape', '', '/images/*', '/__proto__/x'])(
    'returns a schema failure for an invalid media target: %s',
    (target) => {
      const result = workshopContractSchema.safeParse({
        id: 'fixture/native',
        sourceCommit: 'a'.repeat(40),
        inputSchema: {},
        media: [
          {
            name: 'image',
            label: 'Image',
            accept: 'image',
            encoding: 'base64',
            targets: [target]
          }
        ],
        output: { format: 'auto', contentTypes: ['*/*'] }
      })
      expect(result.success).toBe(false)
    }
  )

  it('identifies missing required media separately from rejected media', async () => {
    const contract = workshopContractSchema.parse({
      id: 'fixture/native',
      sourceCommit: 'a'.repeat(40),
      inputSchema: { type: 'object' },
      media: [
        {
          name: 'photo',
          label: 'Photo',
          accept: 'image',
          encoding: 'base64',
          targets: ['/image'],
          required: true
        }
      ],
      output: { format: 'auto', contentTypes: ['*/*'] }
    })
    await expect(
      prepareWorkshopRouterInput(contract, {}, new AbortController().signal)
    ).rejects.toMatchObject({ fieldErrors: { photo: 'required' } })
  })

  it('accepts a new schema-only model and preserves exact JSON values without provider code', async () => {
    const snapshot = {
      id: 'fixture/native-model',
      sourceCommit: snapshots[0].sourceCommit,
      document: {
        openapi: '3.0.3',
        'x-comfy-router-model-id': 'fixture/native-model',
        'x-comfy-input-schema-authored': true,
        'x-comfy-output-schema-authored': false,
        paths: {
          '/v2/models/fixture/native-model': {
            post: {
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['value', 'content'],
                      properties: {
                        value: { type: 'integer', nullable: true },
                        content: { type: 'string' }
                      },
                      additionalProperties: { type: 'boolean' }
                    }
                  }
                }
              },
              responses: {
                '200': { content: { 'application/json': { schema: {} } } }
              }
            }
          }
        }
      }
    }
    const [contract] = z
      .array(workshopContractRecordSchema)
      .parse(JSON.parse(compileWorkshopContracts([snapshot])))
    const body = { value: null, content: '', custom: false }
    expect(
      await prepareWorkshopRouterInput(
        contract,
        { request_body: JSON.stringify(body) },
        new AbortController().signal
      )
    ).toEqual(body)
    await expect(
      prepareWorkshopRouterInput(
        contract,
        { request_body: JSON.stringify({ ...body, value: 'no' }) },
        new AbortController().signal
      )
    ).rejects.toMatchObject({ fieldErrors: { request_body: 'rejected' } })
    await expect(
      prepareWorkshopRouterInput(
        contract,
        { request_body: JSON.stringify(body), content: 'ambiguous' },
        new AbortController().signal
      )
    ).rejects.toMatchObject({ reason: 'validation' })
    expect(() => compileWorkshopContracts([snapshot, snapshot])).toThrow(
      'Duplicate'
    )
    expect(() =>
      compileWorkshopContracts([
        {
          ...snapshot,
          document: {
            ...snapshot.document,
            paths: {
              '/v2/models/fixture/native-model': {
                post: {
                  ...snapshot.document.paths['/v2/models/fixture/native-model']
                    .post,
                  responses: { '403': {} }
                }
              }
            }
          }
        }
      ])
    ).toThrow('Missing Router response: fixture/native-model')
    expect(
      JSON.parse(
        compileWorkshopContracts([
          {
            ...snapshot,
            document: {
              ...snapshot.document,
              'x-comfy-input-schema-authored': false
            }
          }
        ])
      )
    ).toEqual([])
  })
  it(
    'enables every authored input without requiring a presentation binding',
    { timeout: 15_000 },
    () => {
      const generated = z
        .array(workshopContractRecordSchema)
        .parse(JSON.parse(compileWorkshopContracts(rawSnapshots)))
      expect(generated.map((entry) => entry.id).sort()).toEqual(
        snapshots
          .filter((entry) => entry.document['x-comfy-input-schema-authored'])
          .map((entry) => entry.id)
          .sort()
      )
      expect(
        generated.some(
          (entry) => entry.output.format === 'auto' && !entry.output.schema
        )
      ).toBe(true)
    }
  )

  it(
    'generates the committed packed contracts deterministically',
    { timeout: 15_000 },
    () => {
      const packed = compileWorkshopContracts(rawSnapshots, rawBindings)
      expect(JSON.parse(packed)).toEqual(packedContracts)
      expect(
        compileWorkshopContracts(
          [...rawSnapshots].reverse(),
          [...rawBindings].reverse()
        )
      ).toBe(packed)
      expect(packed.trimEnd().split('\n')).toHaveLength(contracts.length + 2)
    }
  )

  it.for(contracts)(
    'derives the complete native form for $id independently of display content',
    (contract) => {
      const form = formForContract(contract)
      const fields = fieldsForDefinition(form)
      expect(fields.length).toBeGreaterThan(0)
      expect(new Set(fields.map((field) => field.name)).size).toBe(
        fields.length
      )
      for (const name of form.advancedFields)
        expect(fields.find((field) => field.name === name)?.advanced).toBe(true)
    }
  )

  it.for(
    contracts.filter((contract) =>
      workshopModels.some((model) => model.routerId === contract.id)
    )
  )('connects the matched Router model $id to its page', (contract) => {
    const card = workshopModels.find(
      (model) => model.routerId === contract.id && !model.incompleteReason
    )
    expect(card).toBeDefined()
    if (!card) throw new Error('Missing Router card')
    const detail = getRouterWorkshopModelDetail(card.slug)
    expect(card.incompleteReason).toBeUndefined()
    expect(detail?.incompleteReason).toBeUndefined()
    const { creatorVariants, ...base } = workshopContractSchema.parse(contract)
    const content = routerContentBySlug.get(card.slug)
    if (!content) throw new Error('Missing content record')
    const creator = creatorVariants?.[content.overlay.id] ?? base.creator
    expect(detail?.execution).toEqual({
      ...base,
      ...(creator ? { creator } : {})
    })
    if (!detail?.form) throw new Error('Missing Router form')
    const fields = fieldsForDefinition(detail.form)
    expect(fields.length).toBeGreaterThan(0)
    expect(new Set(fields.map((field) => field.name)).size).toBe(fields.length)
    for (const name of detail.form.advancedFields)
      expect(fields.find((field) => field.name === name)?.advanced).toBe(true)
  })

  it.for(
    contracts.filter((entry) => Object.hasOwn(entry.inputSchema, 'example'))
  )(
    'round-trips the authored input example through request validation: $id',
    async (contract) => {
      const body = await prepareWorkshopRouterInput(
        contract,
        exampleValues(contract),
        new AbortController().signal
      )
      expect(body).toEqual({
        ...contract.defaultInput,
        ...object.parse(contract.inputSchema.example)
      })
      expect(validateWorkshopInput(body, contract.inputSchema)).toBe(true)
    }
  )

  it.for(
    contracts.filter(
      (entry) =>
        entry.output.format === 'auto' &&
        entry.output.contentTypes.includes('text/event-stream')
    )
  )(
    'rejects user-controlled streaming mode but retains event responses: $id',
    async (contract) => {
      const body = {
        ...object.parse(contract.inputSchema.example),
        stream: true
      }
      await expect(
        prepareWorkshopRouterInput(
          contract,
          { request_body: JSON.stringify(body) },
          new AbortController().signal
        )
      ).rejects.toMatchObject({ reason: 'validation' })
      const events = 'event: delta\ndata: {"text":"hello"}\n\ndata: [DONE]\n\n'
      const outputs = await parseRouterResponse(
        contract,
        new Response(events, {
          headers: { 'Content-Type': 'text/event-stream' }
        })
      )
      try {
        expect(outputs[0].kind).toBe('text')
        expect(outputs[0].text).toBe(events)
      } finally {
        releaseRouterOutputs(outputs)
      }
    }
  )

  it.for(
    contracts.filter(
      (entry) =>
        entry.output.format !== 'binary' &&
        entry.output.schema?.example !== undefined
    )
  )(
    'retains the authored response, including unrecognized output shapes: $id',
    async (contract) => {
      if (contract.output.format === 'binary')
        throw new Error('Expected JSON fixture')
      const outputs = await parseRouterResponse(
        contract,
        Response.json(contract.output.schema?.example)
      )
      try {
        expect(outputs.length).toBeGreaterThan(0)
        expect(
          outputs.every(
            (output) =>
              output.url.startsWith('https://') ||
              output.url.startsWith('blob:')
          )
        ).toBe(true)
        if (contract.output.format === 'auto')
          expect(outputs.at(-1)?.text).toBeDefined()
      } finally {
        releaseRouterOutputs(outputs)
      }
    }
  )
})
