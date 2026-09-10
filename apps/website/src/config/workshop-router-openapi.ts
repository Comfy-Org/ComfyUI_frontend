import { z } from 'astro/zod'

import type { WorkshopFormDefinition } from './workshop-form-definition'

const jsonObject = z.record(z.string(), z.json())
const mediaType = z.looseObject({ schema: jsonObject })
const content = z.record(z.string(), mediaType)
const operation = z.looseObject({
  requestBody: z.looseObject({ content }),
  responses: z.record(
    z.string(),
    z.looseObject({ content: content.optional() })
  )
})
const documentSchema = z.looseObject({
  openapi: z.enum(['3.0.0', '3.0.1', '3.0.2', '3.0.3', '3.0.4']),
  'x-comfy-router-model-id': z.string(),
  'x-comfy-input-schema-authored': z.boolean(),
  'x-comfy-output-schema-authored': z.boolean(),
  paths: z.record(z.string(), z.looseObject({ post: operation })),
  components: z
    .looseObject({ schemas: z.record(z.string(), jsonObject).optional() })
    .optional()
})

const routerOpenApiSnapshotSchema = z.object({
  id: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  sourceCommit: z.string().regex(/^[a-f0-9]{40}$/),
  document: documentSchema
})
export type RouterOpenApiSnapshot = z.infer<typeof routerOpenApiSnapshotSchema>

export function parseRouterOpenApiSnapshot(
  value: unknown
): RouterOpenApiSnapshot {
  const snapshot = routerOpenApiSnapshotSchema.parse(value)
  const { document, id } = snapshot
  if (document['x-comfy-router-model-id'] !== id)
    throw new Error(`Router schema identity mismatch: ${id}`)
  if (!Object.hasOwn(document.paths, `/v2/models/${id}`))
    throw new Error(`Missing Router operation: ${id}`)
  const input = document.paths[`/v2/models/${id}`].post.requestBody.content
  if (!Object.hasOwn(input, 'application/json'))
    throw new Error(`Unsupported Router request content type: ${id}`)
  checkReferences(document, document)
  return snapshot
}

function pointer(root: unknown, reference: string): Record<string, unknown> {
  if (!reference.startsWith('#/components/schemas/'))
    throw new Error(`Unsupported schema reference: ${reference}`)
  let value = root
  for (const encoded of reference.slice(2).split('/')) {
    const key = decodeURIComponent(encoded)
      .replaceAll('~1', '/')
      .replaceAll('~0', '~')
    if (!isObject(value) || !Object.hasOwn(value, key))
      throw new Error(`Unresolved schema reference: ${reference}`)
    value = value[key]
  }
  if (!isObject(value))
    throw new Error(`Invalid schema reference: ${reference}`)
  return value
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function checkReferences(value: unknown, root: unknown): void {
  if (Array.isArray(value)) {
    value.forEach((item) => checkReferences(item, root))
  } else if (isObject(value)) {
    if (typeof value.$ref === 'string') pointer(root, value.$ref)
    Object.values(value).forEach((item) => checkReferences(item, root))
  }
}

export function resolveSchemaReference(
  schema: Readonly<Record<string, unknown>>,
  root: Readonly<Record<string, unknown>>
): z.infer<typeof jsonObject> {
  const seen = new Set<string>()
  const annotationKeys = new Set([
    'title',
    'description',
    'default',
    'example',
    'examples'
  ])
  let annotations: Record<string, unknown> = {}
  let result = schema
  for (;;) {
    if (typeof result.$ref === 'string') {
      if (seen.has(result.$ref)) throw new Error('Circular schema alias')
      seen.add(result.$ref)
      result = pointer(root, result.$ref)
      continue
    }
    const { anyOf, ...siblings } = result
    if (
      !Array.isArray(anyOf) ||
      anyOf.length !== 1 ||
      !isObject(anyOf[0]) ||
      Object.keys(siblings).some((key) => !annotationKeys.has(key))
    )
      return jsonObject.parse({ ...result, ...annotations })
    annotations = { ...siblings, ...annotations }
    result = anyOf[0]
  }
}

export function routerInputSchema(
  snapshot: RouterOpenApiSnapshot
): z.infer<typeof jsonObject> {
  const { document, id } = snapshot
  const schema =
    document.paths[`/v2/models/${id}`].post.requestBody.content[
      'application/json'
    ].schema
  return {
    ...jsonObject.parse(resolveSchemaReference(schema, document)),
    ...(document.components?.schemas
      ? { components: { schemas: document.components.schemas } }
      : {})
  }
}

export function routerFormDefinition(
  snapshot: RouterOpenApiSnapshot,
  advancedFields: readonly string[] = []
): WorkshopFormDefinition | undefined {
  if (!snapshot.document['x-comfy-input-schema-authored']) return undefined
  return {
    source: 'router',
    parameters: routerInputSchema(snapshot),
    roles: [],
    advancedFields
  }
}
