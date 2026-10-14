import type { ContentCatalogRecord } from '@comfyorg/ingest-types'
import { jsonObject } from './editor-document'
import {
  workflowCatalogDetailsSchema,
  validCloudShareURL,
  validDocumentationURL,
  validWorkflowDownloadURL
} from '@/config/workflow-catalog-details'

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
  const fields = ['title', 'description', 'long_description']
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
  preview = false,
  resources: readonly ContentCatalogRecord[] = []
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
  const mediaTypes = jsonObject.safeParse(d.website_media_types)
  const faq = Array.isArray(local.faq) ? local.faq : d.faq
  const catalogDetails = workflowCatalogDetailsSchema.safeParse({
    locale: ['en', 'zh-CN', 'ja'].includes(locale) ? locale : 'en',
    cloudShareURL:
      typeof d.cloud_share_url === 'string' &&
      validCloudShareURL(d.cloud_share_url)
        ? d.cloud_share_url
        : undefined,
    documentationURL:
      typeof d.documentation_url === 'string' &&
      validDocumentationURL(d.documentation_url)
        ? d.documentation_url
        : undefined,
    workflowFiles: Array.isArray(d.workflow_files)
      ? d.workflow_files.flatMap((raw, index) => {
          const entry = objectPresentation(raw)
          const file = objectPresentation(entry.file)
          const href = urls.success
            ? urls.data[`$.workflow_files[${index}].file`]
            : undefined
          if (
            typeof entry.name !== 'string' ||
            !entry.name.trim() ||
            typeof href !== 'string' ||
            !validWorkflowDownloadURL(href)
          )
            return []
          return [
            {
              name: entry.name.trim(),
              uid: file.id,
              version: file.file_version_uid,
              href
            }
          ]
        })
      : undefined,
    longDescription: text('long_description', '').trim() || undefined,
    faqs: Array.isArray(faq)
      ? faq.flatMap((raw, index) => {
          const parsed = jsonObject.safeParse(raw)
          if (!parsed.success) return []
          const { question, answer } = parsed.data
          return typeof question === 'string' &&
            question.trim() &&
            typeof answer === 'string' &&
            answer.trim()
            ? [
                {
                  id: `catalog-faq-${index}`,
                  question: question.trim(),
                  answer: answer.trim()
                }
              ]
            : []
        })
      : [],
    worksOnCloud:
      typeof d.works_on_cloud === 'boolean' ? d.works_on_cloud : undefined,
    runnable: typeof d.runnable === 'boolean' ? d.runnable : undefined,
    scriptCode: d.script_code,
    outputType:
      typeof d.output_type === 'string' && d.output_type.trim()
        ? d.output_type
        : undefined,
    models: Array.isArray(d.model_uids)
      ? d.model_uids.flatMap((uid) => {
          if (typeof uid !== 'string' || !uid.trim()) return []
          const resource = resources.find(
            (candidate) =>
              candidate.uid === uid &&
              candidate.data.type === 'model' &&
              !candidate.deleted
          )
          const translation = objectPresentation(
            objectPresentation(resource?.data.translations)[locale]
          )
          const name =
            typeof translation.title === 'string' &&
            (preview || translation.review_state === 'reviewed')
              ? translation.title
              : resource?.data.title
          const href = resource?.slug
          return [
            {
              uid,
              name: typeof name === 'string' && name.trim() ? name.trim() : uid,
              ...(href && /^\/hub\/models\/[a-z0-9._-]+\/?$/.test(href)
                ? {
                    href: `${locale === 'en' ? '' : `/${locale}`}${href.replace(/\/$/, '')}/`
                  }
                : {})
            }
          ]
        })
      : [],
    author:
      typeof d.author_uid === 'string' && d.author_uid.trim()
        ? d.author_uid.trim()
        : undefined,
    runs:
      typeof d.runs === 'number' && Number.isSafeInteger(d.runs) && d.runs >= 0
        ? d.runs
        : undefined,
    downloads:
      typeof d.downloads === 'number' &&
      Number.isSafeInteger(d.downloads) &&
      d.downloads >= 0
        ? d.downloads
        : undefined
  })
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
            ...(mediaTypes.success &&
            ['video/mp4', 'video/webm'].includes(
              String(mediaTypes.data[`$.examples[${index}].media`])
            )
              ? { mediaKind: 'video' }
              : {}),
            thumbnailUrl: typeof url === 'string' ? url : ''
          }
        })
      : [],
    ...(typeof hero === 'string'
      ? {
          thumbnailUrl: hero,
          thumbnail: {
            url: hero,
            kind:
              mediaTypes.success &&
              ['video/mp4', 'video/webm'].includes(
                String(
                  mediaTypes.data[
                    urls.success && typeof urls.data['$.hero'] === 'string'
                      ? '$.hero'
                      : '$.thumbnail'
                  ]
                )
              )
                ? 'video'
                : (preserved.thumbnailKind ?? 'image'),
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
          ...(catalogDetails.success
            ? { catalogDetails: catalogDetails.data }
            : {}),
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
