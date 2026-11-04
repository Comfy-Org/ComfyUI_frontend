import { isUndefined, omit, omitBy, uniq } from 'es-toolkit'
import { z } from 'zod'

import type { Modality } from '@/renderer/extensions/superComfy/engine/documentSchema'
import type {
  JsonSchema,
  OpenApiDoc
} from '@/renderer/extensions/superComfy/router/routerTypes'

const MAX_DEPTH = 16
const PRIMARY_ORDER: readonly Modality[] = [
  'video',
  '3d',
  'image',
  'audio',
  'text'
]

function tolerant<T extends z.ZodType>(schema: T) {
  return schema.optional().catch(undefined)
}

const zJsonSchema: z.ZodType<JsonSchema> = z.lazy(() =>
  z.looseObject({
    $ref: tolerant(z.string()),
    type: tolerant(z.union([z.string(), z.array(z.string())])),
    enum: tolerant(z.array(z.unknown())),
    default: z.unknown().optional(),
    const: z.unknown().optional(),
    minimum: tolerant(z.number()),
    maximum: tolerant(z.number()),
    exclusiveMinimum: tolerant(z.union([z.number(), z.boolean()])),
    exclusiveMaximum: tolerant(z.union([z.number(), z.boolean()])),
    maxItems: tolerant(z.number()),
    maxLength: tolerant(z.number()),
    description: tolerant(z.string()),
    title: tolerant(z.string()),
    format: tolerant(z.string()),
    nullable: tolerant(z.boolean()),
    deprecated: tolerant(z.boolean()),
    properties: tolerant(z.record(z.string(), zJsonSchema)),
    required: tolerant(z.array(z.string())),
    items: tolerant(zJsonSchema),
    allOf: tolerant(z.array(zJsonSchema)),
    anyOf: tolerant(z.array(zJsonSchema)),
    oneOf: tolerant(z.array(zJsonSchema))
  })
)

const zOpenApiDoc: z.ZodType<OpenApiDoc> = z.looseObject({
  paths: tolerant(
    z.record(
      z.string(),
      z.looseObject({
        post: tolerant(
          z.looseObject({
            requestBody: tolerant(
              z.looseObject({
                content: tolerant(
                  z.record(
                    z.string(),
                    z.looseObject({ schema: tolerant(zJsonSchema) })
                  )
                )
              })
            )
          })
        )
      })
    )
  ),
  components: tolerant(
    z.looseObject({
      schemas: tolerant(z.record(z.string(), zJsonSchema))
    })
  ),
  'x-comfy-router-input-modalities': tolerant(z.array(z.string())),
  'x-comfy-router-output-modalities': tolerant(z.array(z.string())),
  'x-comfy-input-schema-authored': tolerant(z.boolean())
})

export function requestSchemaOf(doc: OpenApiDoc): JsonSchema | null {
  const first = Object.values(doc.paths ?? {}).at(0)
  const content = first?.post?.requestBody?.content
  return ownEntry(content, 'application/json')?.schema ?? null
}

export function parseOpenApiDoc(raw: unknown): OpenApiDoc | null {
  const parsed = zOpenApiDoc.safeParse(raw)
  if (!parsed.success || !requestSchemaOf(parsed.data)) return null
  return parsed.data
}

function ownEntry<T>(
  record: Record<string, T> | undefined,
  key: string
): T | undefined {
  return record && Object.hasOwn(record, key) ? record[key] : undefined
}

export function componentSchema(
  doc: OpenApiDoc,
  name: string
): JsonSchema | undefined {
  return ownEntry(doc.components?.schemas, name)
}

function definedFields(schema: JsonSchema): JsonSchema {
  return omitBy(schema, isUndefined)
}

export function derefSchema(
  doc: OpenApiDoc,
  schema: JsonSchema,
  depth = 0
): JsonSchema {
  if (schema.$ref === undefined || depth > MAX_DEPTH) return schema
  const name = schema.$ref.slice(schema.$ref.lastIndexOf('/') + 1)
  const target = ownEntry(doc.components?.schemas, name) ?? {}
  return derefSchema(
    doc,
    { ...definedFields(target), ...definedFields(omit(schema, ['$ref'])) },
    depth + 1
  )
}

function mergeParts(base: JsonSchema, part: JsonSchema): JsonSchema {
  const hasProperties = base.properties || part.properties
  return {
    ...definedFields(part),
    ...definedFields(base),
    properties: hasProperties
      ? { ...base.properties, ...part.properties }
      : undefined,
    required: uniq([...(base.required ?? []), ...(part.required ?? [])])
  }
}

function mergeAllOf(
  doc: OpenApiDoc,
  schema: JsonSchema,
  depth: number
): JsonSchema {
  if (!schema.allOf?.length) return schema
  return schema.allOf
    .map((part) => flattenSchema(doc, part, depth + 1))
    .reduce(mergeParts, omit(schema, ['allOf']))
}

export function isNullSchema(schema: JsonSchema): boolean {
  if (Array.isArray(schema.type)) {
    return schema.type.every((type) => type === 'null')
  }
  return schema.type === 'null'
}

function widestEnum(branches: readonly JsonSchema[]): JsonSchema | undefined {
  return branches.reduce<JsonSchema | undefined>(
    (widest, branch) =>
      !widest || (branch.enum?.length ?? 0) > (widest.enum?.length ?? 0)
        ? branch
        : widest,
    undefined
  )
}

function pickBranch(branches: readonly JsonSchema[]): JsonSchema | undefined {
  return (
    branches.find(
      (branch) => branch.type === 'object' || branch.properties !== undefined
    ) ??
    branches.find(
      (branch) => branch.minimum !== undefined || branch.maximum !== undefined
    ) ??
    widestEnum(branches)
  )
}

function collapseUnion(
  doc: OpenApiDoc,
  schema: JsonSchema,
  depth: number
): JsonSchema {
  const union = schema.anyOf ?? schema.oneOf
  if (!union?.length || schema.properties) return schema
  const branches = union.map((branch) => flattenSchema(doc, branch, depth + 1))
  const real = branches.filter((branch) => !isNullSchema(branch))
  const pick = pickBranch(real)
  if (!pick) return schema
  const own = definedFields(omit(schema, ['anyOf', 'oneOf']))
  const enums = real.every((branch) => branch.enum)
    ? real.flatMap((branch) => branch.enum ?? [])
    : pick.enum
  return {
    ...definedFields(pick),
    ...own,
    enum: enums,
    nullable:
      real.length < branches.length ||
      own.nullable === true ||
      pick.nullable === true
  }
}

export function flattenSchema(
  doc: OpenApiDoc,
  schema: JsonSchema,
  depth = 0
): JsonSchema {
  if (depth > MAX_DEPTH) return schema
  const resolved = derefSchema(doc, schema)
  return collapseUnion(doc, mergeAllOf(doc, resolved, depth), depth)
}

export function schemaAt(
  doc: OpenApiDoc,
  root: JsonSchema,
  path: readonly string[]
): JsonSchema | null {
  return path.reduce<JsonSchema | null>(
    (node, key) => {
      const next = ownEntry(node?.properties, key)
      return next ? flattenSchema(doc, next) : null
    },
    flattenSchema(doc, root)
  )
}

export function schemaType(schema: JsonSchema): string | undefined {
  const declared = Array.isArray(schema.type)
    ? schema.type.find((type) => type !== 'null')
    : schema.type
  if (declared) return declared
  const first = schema.enum?.find((value) => value !== null)
  if (typeof first === 'number') {
    return Number.isInteger(first) ? 'integer' : 'number'
  }
  if (typeof first === 'boolean') return 'boolean'
  return typeof first === 'string' ? 'string' : undefined
}

export function propertiesOf(
  schema: JsonSchema
): [name: string, schema: JsonSchema][] {
  return Object.entries(schema.properties ?? {})
}

function refsIn(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(refsIn)
  if (typeof value !== 'object' || value === null) return []
  return Object.entries(value).flatMap(([key, child]) =>
    key === '$ref' && typeof child === 'string'
      ? [child.slice(child.lastIndexOf('/') + 1)]
      : refsIn(child)
  )
}

export function reachableSchemas(
  doc: OpenApiDoc,
  root: JsonSchema
): Record<string, JsonSchema> {
  const reached = new Map<string, JsonSchema>()
  const frontier = refsIn(root)
  for (let cursor = 0; cursor < frontier.length; cursor++) {
    const name = frontier[cursor]
    const schema = ownEntry(doc.components?.schemas, name)
    if (reached.has(name) || !schema) continue
    reached.set(name, schema)
    frontier.push(...refsIn(schema))
  }
  return Object.fromEntries(reached)
}

export function inputModalities(doc: OpenApiDoc): ReadonlySet<string> {
  return new Set(doc['x-comfy-router-input-modalities'] ?? [])
}

export function primaryModality(outputs: readonly string[]): Modality | null {
  return PRIMARY_ORDER.find((modality) => outputs.includes(modality)) ?? null
}
