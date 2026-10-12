import type { ContentCatalogRecord } from '@comfyorg/ingest-types'
import { jsonObject } from './editor-document'

export function catalogLanguageFallback(
  record: ContentCatalogRecord,
  locale: string,
  preview: boolean
) {
  if (!['model', 'workflow', 'app'].includes(String(record.data.type)))
    return undefined
  const source =
    typeof record.data.source_locale === 'string'
      ? record.data.source_locale
      : 'en'
  if (locale === source) return undefined
  const translations = jsonObject.safeParse(record.data.translations)
  const translated = jsonObject.safeParse(
    translations.success ? translations.data[locale] : undefined
  )
  const eligible =
    translated.success &&
    (preview || translated.data.review_state === 'reviewed')
  const fields = ['title', 'description']
    .filter(
      (field) =>
        typeof record.data[field] === 'string' &&
        record.data[field] !== '' &&
        (!eligible || typeof translated.data[field] !== 'string')
    )
    .map((field) => `$.${field}`)
  return fields.length ? { source, fields } : undefined
}

// A presentation adapter, not an independent authored source. Native CCC
// documents do not contain copies of the legacy website view model.
export function catalogPresentation(
  record: ContentCatalogRecord,
  locale = 'en',
  preview = false
) {
  if (!['model', 'workflow', 'app'].includes(String(record.data.type)))
    return record.data
  const doc = jsonObject.safeParse(record.data)
  if (!doc.success) return undefined
  const d = doc.data
  const compatibility = jsonObject.safeParse(d.compatibility)
  const migrated = jsonObject.safeParse(
    compatibility.success ? compatibility.data.website : undefined
  )
  const preserved = migrated.success ? migrated.data : {}
  const translations = jsonObject.safeParse(d.translations)
  const translated = jsonObject.safeParse(
    translations.success ? translations.data[locale] : undefined
  )
  const local =
    translated.success &&
    (preview || translated.data.review_state === 'reviewed')
      ? translated.data
      : {}
  const text = (key: string, fallback: string) =>
    typeof local[key] === 'string'
      ? local[key]
      : typeof d[key] === 'string'
        ? d[key]
        : fallback
  const schema = jsonObject.safeParse(d.inputSchema)
  const inputs = jsonObject.safeParse(d.inputs)
  const workflowId = `workflows/${record.uid}`
  const rawSchema = schema.success ? schema.data : {}
  const inputSchema = {
    ...rawSchema,
    type: 'object',
    properties: rawSchema.properties ?? {},
    required: rawSchema.required ?? [],
    additionalProperties: false
  }
  const title = text('title', record.uid)
  const urls = jsonObject.safeParse(d.website_media)
  const hero = urls.success
    ? (urls.data['$.hero'] ?? urls.data['$.thumbnail'])
    : undefined
  return {
    ...preserved,
    fields: preserved.fields ?? [],
    defaults: preserved.defaults ?? {},
    examples: Array.isArray(d.examples)
      ? d.examples.map((raw, index) => {
          const parsed = jsonObject.safeParse(raw)
          const example = parsed.success ? parsed.data : {}
          const url = urls.success
            ? urls.data[`$.examples[${index}].media`]
            : undefined
          return {
            ...objectPresentation(example.presentation),
            name:
              typeof example.name === 'string'
                ? example.name
                : `example-${index + 1}`,
            title: typeof example.title === 'string' ? example.title : '',
            description:
              typeof example.description === 'string'
                ? example.description
                : '',
            tags: Array.isArray(example.tags) ? example.tags : [],
            values: example.values ?? {},
            thumbnailUrl: typeof url === 'string' ? url : ''
          }
        })
      : [],
    ...(typeof hero === 'string'
      ? {
          thumbnailUrl: hero,
          thumbnail: {
            url: hero,
            kind: preserved.thumbnailKind ?? 'image',
            ...(urls.success && typeof urls.data['$.hero_poster'] === 'string'
              ? { poster: urls.data['$.hero_poster'] }
              : {})
          }
        }
      : {}),
    slug:
      preserved.slug ??
      (d.type === 'workflow' ? `workflows/${String(d.slug)}` : d.slug),
    name: title,
    summary: text('description', ''),
    href: `${record.slug}/`,
    workflowCount: preserved.workflowCount ?? 0,
    capabilities: Array.isArray(d.tags) ? d.tags : [],
    ...(typeof d.generation_type === 'string'
      ? { useCases: [d.generation_type] }
      : {}),
    ...(typeof d.provider === 'string' ? { provider: d.provider } : {}),
    ...(d.type === 'model'
      ? {
          type: 'MODEL',
          routerId:
            typeof d.router_model_id === 'string'
              ? d.router_model_id
              : record.uid,
          ...(preserved.execution
            ? {
                execution: {
                  ...objectPresentation(preserved.execution),
                  inputSchema,
                  inputs: inputs.success ? inputs.data : {}
                }
              }
            : {})
        }
      : {}),
    ...(d.type === 'workflow'
      ? {
          type: 'CLOUD',
          workflowId: preserved.workflowId ?? workflowId,
          workflow: {
            ...objectPresentation(preserved.workflow),
            id: objectPresentation(preserved.workflow).id ?? workflowId,
            definitionVersion:
              objectPresentation(preserved.workflow).definitionVersion ??
              record.edit_version,
            inputSchema,
            inputs: inputs.success ? inputs.data : {},
            ...(objectPresentation(preserved.workflow).cloud
              ? {
                  cloud: {
                    ...objectPresentation(
                      objectPresentation(preserved.workflow).cloud
                    ),
                    inputBindings: d.inputBindings ?? {}
                  }
                }
              : {})
          }
        }
      : {}),
    ...(d.type === 'app' ? { type: 'APP', appId: d.implementation_ref } : {})
  }
}

function objectPresentation(value: unknown) {
  const parsed = jsonObject.safeParse(value)
  return parsed.success ? parsed.data : {}
}
