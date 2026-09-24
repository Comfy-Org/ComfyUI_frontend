import { z } from 'astro/zod'

import { workflowSchema } from './workshop-workflow-catalog-schema'

import type { WorkshopFormDefinition } from './workshop-form-definition'
import { fieldsForDefinition } from './workshop-form-definition'
import {
  inputControlMatches,
  workshopInputDefinitionSchema
} from './workshop-input-definition'

export const workshopTemplateSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9._-]+$/),
  author: z.string().min(1),
  models: z.array(z.string().min(1)),
  previewUrl: z
    .string()
    .regex(/^\/workflows\/prepared\/[a-z0-9-]+\.svg$/)
    .optional(),
  downloadUrl: z
    .string()
    .regex(/^\/workflows\/prepared\/[a-z0-9-]+\.json$/)
    .optional()
})

export const workshopWorkflowDefinitionSchema = z.object({
  id: z.string().regex(/^workflows\/[a-z0-9][a-z0-9._-]*$/),
  definitionVersion: z.string().min(1),
  inputSchema: z
    .object({
      type: z.literal('object'),
      properties: z.record(z.string(), z.record(z.string(), z.json())),
      required: z.array(z.string()),
      additionalProperties: z.literal(false)
    })
    .catchall(z.json()),
  inputs: z.record(z.string(), workshopInputDefinitionSchema),
  cloud: workflowSchema.shape.cloud.optional(),
  outputs: workflowSchema.shape.outputs.optional(),
  template: workshopTemplateSchema.optional()
})

export type WorkshopWorkflowDefinition = z.infer<
  typeof workshopWorkflowDefinitionSchema
>

export function formForWorkflow(
  definition: WorkshopWorkflowDefinition
): WorkshopFormDefinition {
  const names = Object.keys(definition.inputs)
  const declared = Object.keys(definition.inputSchema.properties)
  if (
    names.length !== declared.length ||
    names.some((name) => !declared.includes(name))
  )
    throw new Error(`Workflow page inputs do not match: ${definition.id}`)
  const form: WorkshopFormDefinition = {
    parameters: {
      ...definition.inputSchema,
      properties: Object.fromEntries(
        names.map((name) => [name, definition.inputSchema.properties[name]])
      )
    },
    inputs: definition.inputs,
    roles: [],
    advancedFields: Object.entries(definition.inputs)
      .filter(([, input]) => input.advanced && !input.hidden)
      .map(([name]) => name)
  }
  for (const field of fieldsForDefinition(form)) {
    const input = definition.inputs[field.name]
    if (!inputControlMatches(input, field))
      throw new Error(
        `Input control does not match its declared type: ${field.name}`
      )
  }
  return form
}
