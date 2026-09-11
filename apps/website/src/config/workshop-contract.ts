import { z } from 'astro/zod'

import type { WorkshopFormDefinition } from './workshop-form-definition'
import { pointerKeys } from './workshop-json-pointer'
import { resolveSchemaReference } from './workshop-router-openapi'
import { workshopInputDefinitionSchema } from './workshop-input-definition'
import { workshopCreatorFormSchema } from './workshop-creator-form'

const jsonSchema = z.record(z.string(), z.json())
const pointer = z.string().refine((value) => {
  try {
    pointerKeys(value)
    return true
  } catch {
    return false
  }
})
const kind = z.enum(['image', 'video', 'audio', '3d', 'text', 'other'])

const mediaSchema = z.object({
  name: z
    .string()
    .min(1)
    .refine(
      (name) =>
        !['__proto__', 'prototype', 'constructor', 'request_body'].includes(
          name
        )
    ),
  label: z.string().min(1),
  accept: z.enum(['image', 'video', 'audio', 'file']),
  encoding: z.enum(['base64', 'data-url']),
  targets: z
    .array(
      pointer.pipe(
        z
          .string()
          .refine((value) => value !== '' && !pointerKeys(value).includes('*'))
      )
    )
    .min(1),
  required: z.boolean().default(false)
})

const selectorSchema = z.object({
  path: pointer,
  encoding: z.enum(['url', 'base64', 'text', 'json']),
  kind,
  mimeType: z.string().optional()
})

const outputSchema = z.discriminatedUnion('format', [
  z.object({
    format: z.literal('auto'),
    schema: jsonSchema.optional(),
    contentTypes: z.array(z.string()).min(1)
  }),
  z.object({
    format: z.literal('json'),
    schema: jsonSchema,
    selectors: z.array(selectorSchema).min(1),
    success: z
      .object({
        path: pointer,
        values: z.array(z.union([z.string(), z.number(), z.boolean()])).min(1),
        caseInsensitive: z.boolean().default(false)
      })
      .optional(),
    nsfwPath: pointer.optional()
  }),
  z.object({
    format: z.literal('binary'),
    kind,
    contentTypes: z
      .array(z.string().regex(/^[\w.+-]+\/(?:[\w.+-]+|\*)$/))
      .min(1)
  })
])

export const workshopContractSchema = z.object({
  id: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  sourceCommit: z.string().regex(/^[a-f0-9]{40}$/),
  inputSchema: jsonSchema,
  inputs: z.record(z.string(), workshopInputDefinitionSchema).optional(),
  defaultInput: jsonSchema.optional(),
  creator: workshopCreatorFormSchema.optional(),
  creatorVariants: z.record(z.string(), workshopCreatorFormSchema).optional(),
  media: z.array(mediaSchema).default([]),
  advancedFields: z.array(z.string()).default([]),
  output: outputSchema
})

export type WorkshopContract = z.infer<typeof workshopContractSchema>
export type WorkshopMediaBinding = z.infer<typeof mediaSchema>
export const workshopContractRecordSchema = workshopContractSchema.extend({
  catalogId: z.string()
})

export const workshopBindingSchema = z.object({
  id: z.string(),
  routerId: z.string(),
  omit: z.array(z.string()).default([]),
  media: z.array(mediaSchema).default([]),
  advancedFields: z.array(z.string()).default([]),
  output: z.discriminatedUnion('format', [
    outputSchema.options[1].omit({ schema: true }),
    outputSchema.options[2]
  ])
})

const forms = new WeakMap<WorkshopContract, WorkshopFormDefinition>()

export function formForContract(
  contract: WorkshopContract
): WorkshopFormDefinition {
  const cached = forms.get(contract)
  if (cached) return cached
  if (contract.creator) {
    const definition: WorkshopFormDefinition = {
      source: 'router',
      parameters: contract.creator.parameters,
      inputs: contract.creator.inputs,
      files: contract.creator.files,
      roles: [],
      advancedFields: Object.entries(contract.creator.inputs)
        .filter(([, input]) => input.advanced)
        .map(([name]) => name)
    }
    forms.set(contract, definition)
    return definition
  }
  const parameters = resolveSchemaReference(
    contract.inputSchema,
    contract.inputSchema
  )
  const hidden = new Set(
    contract.media
      .flatMap((media) => media.targets)
      .map(pointerKeys)
      .filter((keys) => keys.length === 1)
      .map(([key]) => key)
  )
  if (contract.inputs) {
    const inputs = new Map(Object.entries(contract.inputs))
    const properties = jsonSchema.parse(parameters.properties ?? {})
    for (const name of Object.keys(properties))
      if (!inputs.has(name) || inputs.get(name)?.hidden) hidden.add(name)
  }
  const properties = parameters.properties
  const definition: WorkshopFormDefinition = {
    source: 'router',
    parameters: {
      ...parameters,
      ...(Array.isArray(parameters.required)
        ? {
            required: parameters.required.filter(
              (name) => typeof name !== 'string' || !hidden.has(name)
            )
          }
        : {}),
      ...(properties &&
      typeof properties === 'object' &&
      !Array.isArray(properties)
        ? {
            properties: Object.fromEntries(
              Object.entries(properties).filter(([key]) => !hidden.has(key))
            )
          }
        : {})
    },
    roles: [],
    advancedFields: contract.advancedFields,
    inputs: contract.inputs,
    media: contract.media
  }
  forms.set(contract, definition)
  return definition
}
