import { z } from 'astro/zod'

import { validateWorkshopInput, validatorFor } from './workshop-json-schema'

const name = z.string().min(1)
const scalarSchema = z
  .object({ type: z.enum(['string', 'number', 'integer', 'boolean']) })
  .catchall(z.json())
const targets = z
  .array(z.object({ nodeId: name, inputName: name }).strict())
  .min(1)
const bindingSchema = z.discriminatedUnion('encoding', [
  z.object({ encoding: z.literal('scalar'), targets }).strict(),
  z
    .object({
      encoding: z.literal('cloud-asset'),
      targets,
      mediaKind: z.enum(['image', 'video', 'audio'])
    })
    .strict()
])
const workflowSchema = z
  .object({
    id: z.string().regex(/^workflows\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
    type: z.literal('CLOUD'),
    definitionVersion: name,
    source: z
      .object({
        repository: name,
        commit: z.string().regex(/^[a-f0-9]{40}$/),
        path: name
      })
      .strict(),
    inputSchema: z
      .object({
        type: z.literal('object'),
        properties: z.record(name, scalarSchema),
        required: z.array(name),
        additionalProperties: z.literal(false)
      })
      .catchall(z.json()),
    cloud: z
      .object({
        workflow: z.record(
          name,
          z
            .object({
              class_type: name,
              inputs: z.record(name, z.json())
            })
            .catchall(z.json())
        ),
        inputBindings: z.record(name, bindingSchema)
      })
      .strict(),
    outputs: z
      .array(
        z
          .object({
            id: name,
            nodeId: name,
            key: name,
            kind: z.enum(['image', 'video', 'audio'])
          })
          .strict()
      )
      .min(1)
  })
  .strict()

export type WorkshopWorkflowEntry = z.infer<typeof workflowSchema>

function validateInputSchema(entry: WorkshopWorkflowEntry): void {
  const { properties, required } = entry.inputSchema
  const { inputBindings } = entry.cloud
  validatorFor(entry.inputSchema)

  if (new Set(required).size !== required.length)
    throw new Error('Repeated required input')
  for (const input of required) {
    if (!Object.hasOwn(properties, input))
      throw new Error(`Required input is not declared: ${input}`)
  }
  for (const [input, schema] of Object.entries(properties)) {
    if (!Object.hasOwn(inputBindings, input))
      throw new Error(`Input has no binding: ${input}`)
    if (
      Object.hasOwn(schema, 'default') &&
      !validateWorkshopInput(schema.default, schema)
    )
      throw new Error(`Input default does not match its schema: ${input}`)
  }
}

function validateBinding(
  entry: WorkshopWorkflowEntry,
  input: string,
  binding: WorkshopWorkflowEntry['cloud']['inputBindings'][string],
  boundTargets: Set<string>
): void {
  const { properties } = entry.inputSchema
  const { workflow } = entry.cloud
  if (!Object.hasOwn(properties, input))
    throw new Error(`Binding input is not declared: ${input}`)
  const schema = properties[input]
  if (binding.encoding === 'cloud-asset' && schema.type !== 'string')
    throw new Error(`Media input must be a URL string: ${input}`)
  for (const target of binding.targets) {
    const node = workflow[target.nodeId]
    if (
      !Object.hasOwn(workflow, target.nodeId) ||
      !Object.hasOwn(node.inputs, target.inputName)
    )
      throw new Error(`Binding target does not exist: ${input}`)
    const key = JSON.stringify([target.nodeId, target.inputName])
    if (boundTargets.has(key))
      throw new Error(`Binding target is used more than once: ${input}`)
    boundTargets.add(key)
    if (
      !validateWorkshopInput(node.inputs[target.inputName], {
        type: schema.type
      })
    )
      throw new Error(`Binding target has an incompatible type: ${input}`)
  }
}

function validateReferences(entry: WorkshopWorkflowEntry): void {
  validateInputSchema(entry)
  const boundTargets = new Set<string>()
  for (const [input, binding] of Object.entries(entry.cloud.inputBindings))
    validateBinding(entry, input, binding, boundTargets)

  const outputIds = new Set<string>()
  for (const output of entry.outputs) {
    if (!Object.hasOwn(entry.cloud.workflow, output.nodeId))
      throw new Error(`Output node does not exist: ${output.id}`)
    if (outputIds.has(output.id))
      throw new Error(`Output ID is used more than once: ${output.id}`)
    outputIds.add(output.id)
  }
}

export function parseWorkflowCatalog(text: string): WorkshopWorkflowEntry[] {
  const entries: WorkshopWorkflowEntry[] = []
  const ids = new Set<string>()
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue
    try {
      const value: unknown = JSON.parse(line)
      const entry = workflowSchema.parse(value)
      if (ids.has(entry.id))
        throw new Error(`Duplicate workflow ID: ${entry.id}`)
      validateReferences(entry)
      ids.add(entry.id)
      entries.push(entry)
    } catch (error) {
      throw new Error(`Invalid workflow catalog entry on line ${index + 1}`, {
        cause: error
      })
    }
  }
  return entries
}
