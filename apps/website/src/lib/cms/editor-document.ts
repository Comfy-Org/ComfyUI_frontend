import type { Cccjson } from '@comfyorg/ingest-types'
import { zGetCccDraftItemResponse } from '@comfyorg/ingest-types/zod'
import { z } from 'astro/zod'

import { workshopInputDefinitionSchema } from '@/config/workshop-input-definition'

export const contentTypes = ['model', 'workflow', 'app'] as const
export type ContentType = (typeof contentTypes)[number]
export type Document = Record<string, z.infer<ReturnType<typeof z.json>>>

// Zod's record output omits literal __proto__ keys. Authored JSON must be
// lossless: copy own entries without invoking Object.prototype setters.
function copyJSON(
  value: unknown,
  parents = new Set<object>()
): Document[string] | undefined {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return value
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : undefined
  if (typeof value !== 'object' || parents.has(value)) return undefined
  const prototype = Object.getPrototypeOf(value)
  if (
    !Array.isArray(value) &&
    prototype !== Object.prototype &&
    prototype !== null
  )
    return undefined
  if (Object.getOwnPropertySymbols(value).length) return undefined
  parents.add(value)
  try {
    if (Array.isArray(value)) {
      const result: Document[string][] = []
      for (const entry of value) {
        const copied = copyJSON(entry, parents)
        if (copied === undefined) return undefined
        result.push(copied)
      }
      return result
    }
    const entries: [string, Document[string]][] = []
    for (const [key, entry] of Object.entries(value)) {
      const copied = copyJSON(entry, parents)
      if (copied === undefined) return undefined
      entries.push([key, copied])
    }
    return Object.fromEntries(entries)
  } finally {
    parents.delete(value)
  }
}

export const jsonObject = z.unknown().transform<Document>((value, ctx) => {
  try {
    const copied = copyJSON(value)
    if (copied !== null && typeof copied === 'object' && !Array.isArray(copied))
      return copied
  } catch {
    // Cycles, hostile getters and excessive nesting must fail, not partially save.
  }
  ctx.addIssue({ code: 'custom', message: 'Expected a complete JSON object' })
  return z.NEVER
})

const metadata = new Set([
  'uid',
  'type',
  'schema_version',
  'revision_uid',
  'catalog_rev',
  'edit_sequence',
  'digest',
  'owner_uid',
  'saved_by_uid',
  'is_deleted',
  'draft_generation',
  'expected_draft_rev',
  'expected_revision_uid'
])

export function authoredDocument(flat: Cccjson): Document | undefined {
  const result = jsonObject.safeParse(
    Object.fromEntries(
      Object.entries(flat).filter(([key]) => !metadata.has(key))
    )
  )
  return result.success ? result.data : undefined
}

// This is the editor's view model, narrowed from the generated open JSON
// contract. It is not a second backend response contract.
export function editorSnapshot(raw: unknown) {
  const parsed = zGetCccDraftItemResponse.safeParse(raw)
  if (!parsed.success) return undefined
  const flat = parsed.data
  // Keep canonical validation, but never substitute its lossy open-record copy.
  const preserved = jsonObject.safeParse(raw)
  const document = preserved.success
    ? authoredDocument(preserved.data)
    : undefined
  const tokens = z
    .object({
      uid: z.uuid(),
      type: z.enum(contentTypes),
      schema_version: z.number().int().positive(),
      revision_uid: z.uuid(),
      expected_draft_rev: z.number().int().positive(),
      expected_revision_uid: z.uuid(),
      is_deleted: z.boolean()
    })
    .safeParse(flat)
  if (!tokens.success || !document) return undefined
  return { ...tokens.data, document }
}

export type EditorSnapshot = NonNullable<ReturnType<typeof editorSnapshot>>

export function blankDocument(): Document {
  return {
    title: '',
    slug: '',
    description: '',
    enabled: false,
    visibility: 'staff',
    available_surfaces: ['hub'],
    tags: [],
    use_cases: []
  }
}

export function objectValue(value: Document[string] | undefined): Document {
  const parsed = jsonObject.safeParse(value)
  return parsed.success ? parsed.data : {}
}

export function arrayObjects(value: Document[string] | undefined): Document[] {
  const parsed = z.array(jsonObject).safeParse(value)
  return parsed.success ? parsed.data : []
}

export function parseObject(text: string) {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return undefined
  }
  const parsed = jsonObject.safeParse(raw)
  return parsed.success ? parsed.data : undefined
}

export function savePayload(
  document: Document,
  type: ContentType,
  draft: number,
  snapshot?: EditorSnapshot
): Cccjson {
  return {
    ...document,
    type,
    schema_version: snapshot?.schema_version ?? 2,
    expected_draft_rev: draft,
    ...(snapshot ? { expected_revision_uid: snapshot.revision_uid } : {})
  }
}

export function hasReservedFields(document: Document) {
  return Object.keys(document).some((key) => metadata.has(key))
}

export function setInput(
  document: Document,
  name: string,
  definition: Document,
  property: Document,
  required: boolean
): Document | undefined {
  if (
    !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(name) ||
    ['__proto__', 'prototype', 'constructor'].includes(name)
  )
    return undefined
  const presentation = workshopInputDefinitionSchema.safeParse(definition)
  if (!presentation.success) return undefined
  if (definition.optionLabels !== undefined) {
    const labels = jsonObject.safeParse(definition.optionLabels)
    const labelSchema =
      workshopInputDefinitionSchema.shape.optionLabels.unwrap().valueType
    if (
      !labels.success ||
      Object.values(labels.data).some(
        (value) => !labelSchema.safeParse(value).success
      )
    )
      return undefined
  }
  const schema = objectValue(document.inputSchema)
  const requiredNames = z.array(z.string()).safeParse(schema.required)
  const names = (requiredNames.success ? requiredNames.data : []).filter(
    (key) => key !== name
  )
  return {
    ...document,
    inputs: {
      ...objectValue(document.inputs),
      [name]: { ...definition }
    },
    inputSchema: {
      ...schema,
      type: 'object',
      properties: { ...objectValue(schema.properties), [name]: property },
      required: required ? [...names, name] : names
    }
  }
}

export function removeInput(document: Document, name: string): Document {
  const inputs = Object.fromEntries(
    Object.entries(objectValue(document.inputs)).filter(([key]) => key !== name)
  )
  const schema = objectValue(document.inputSchema)
  const properties = Object.fromEntries(
    Object.entries(objectValue(schema.properties)).filter(
      ([key]) => key !== name
    )
  )
  const required = z.array(z.string()).safeParse(schema.required)
  // Keep bindings and example values for explicit review; don't silently drop
  // execution intent when removing a presentation field.
  return {
    ...document,
    inputs,
    inputSchema: {
      ...schema,
      properties,
      ...(required.success
        ? { required: required.data.filter((key) => key !== name) }
        : {})
    }
  }
}
