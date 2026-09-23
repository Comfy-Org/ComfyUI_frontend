import type { WorkshopDisplayEntry } from '../content/workshop-display.schema'
import starterPrompts from '../data/workshop-starter-prompts.json'
import type { WorkshopModelDetail } from './models-catalogue'
import { schemaForModel, validateForm } from './workshop-playground'
import { resolveSchemaReference } from './workshop-router-openapi'

const PROMPT_NAMES = new Set([
  'prompt',
  'Prompt',
  'text_prompt',
  'prompt_text',
  'promptText',
  'text',
  'input'
])
const CONTAINERS = new Set([
  'input',
  'inputs',
  'content',
  'contents',
  'messages',
  'parts',
  'instances'
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isPrompt(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function promptOnly(value: unknown, replacement?: string): unknown {
  if (Array.isArray(value)) {
    const items = value
      .map((item) => promptOnly(item, replacement))
      .filter((item) => item !== undefined)
    return items.length ? items : undefined
  }
  if (!isRecord(value) || (value.role && value.role !== 'user')) return
  const entries = Object.entries(value).flatMap(([key, item]) => {
    if ((PROMPT_NAMES.has(key) || key === 'content') && isPrompt(item))
      return [[key, replacement ?? item]]
    if (!CONTAINERS.has(key)) return []
    const child = promptOnly(item, replacement)
    return child === undefined ? [] : [[key, child]]
  })
  if (!entries.length) return
  return {
    ...(value.role === 'user' ? { role: 'user' } : {}),
    ...(value.type === 'text' ? { type: 'text' } : {}),
    ...Object.fromEntries(entries)
  }
}

export function workshopPromptDefaults(
  model: WorkshopModelDetail,
  displays: readonly WorkshopDisplayEntry[]
): Readonly<Record<string, string>> {
  const editorial = displays.flatMap((display) => [
    ...display.examples.flatMap((example) =>
      Object.entries(example.values)
        .filter(([key]) => PROMPT_NAMES.has(key))
        .map(([, value]) => value)
        .filter(isPrompt)
    ),
    ...(display.media.samples ?? [])
      .map((sample) => sample.prompt)
      .filter(isPrompt)
  ])
  const example = model.execution?.inputSchema.example
  const starter = starterPrompts[model.modality ?? 'other']
  const defaults: Record<string, string> = {}
  for (const field of schemaForModel(model)) {
    if (field.kind !== 'text') continue
    const sample =
      field.name === 'request_body'
        ? example
        : isRecord(example)
          ? example[field.name]
          : undefined
    const existing = model.defaults[field.name] ?? field.defaultValue
    let candidates: unknown[]
    if (field.valueType !== 'json') {
      if (!PROMPT_NAMES.has(field.name)) continue
      candidates = [
        ...editorial,
        existing,
        sample,
        starter,
        starterPrompts.short
      ]
    } else {
      const schema = field.inputSchema ?? field.jsonSchema ?? {}
      const properties = resolveSchemaReference(schema, schema).properties
      const names = isRecord(properties)
        ? Object.keys(properties).filter((name) => PROMPT_NAMES.has(name))
        : []
      function draft(text: string) {
        return (
          promptOnly(sample, text) ??
          (names.length
            ? Object.fromEntries(names.map((name) => [name, text]))
            : undefined)
        )
      }
      candidates = [
        ...editorial.map(draft),
        promptOnly(sample),
        draft(starter)
      ].map((value) =>
        value === undefined ? undefined : JSON.stringify(value, null, 2)
      )
      if (isPrompt(existing)) candidates.unshift(existing)
    }
    const chosen = candidates.find(
      (value): value is string =>
        isPrompt(value) &&
        !Object.hasOwn(
          validateForm([field], { [field.name]: value }),
          field.name
        )
    )
    if (chosen !== undefined) defaults[field.name] = chosen
  }
  return defaults
}
