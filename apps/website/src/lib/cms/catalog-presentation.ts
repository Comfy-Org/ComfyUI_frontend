import type { ContentCatalogRecord } from '@comfyorg/ingest-types'
import { jsonObject } from './editor-document'
import type { Document } from './editor-document'
import { translationsFor } from '@/i18n/translations'
import { resolveLocale } from '@/config/locales'
import { USE_CASES } from '@/config/models-catalogue'
import {
  workflowCatalogDetailsSchema,
  validCloudShareURL,
  validDocumentationURL,
  validWorkflowDownloadURL,
  validAuthorAvatarURL
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

function objectPresentation(value: unknown): Document {
  const parsed = jsonObject.safeParse(value)
  return parsed.success ? parsed.data : {}
}

function localizedDocument(d: Document, locale: string, preview: boolean) {
  const translated = objectPresentation(
    objectPresentation(d.translations)[locale]
  )
  return preview || translated.review_state === 'reviewed' ? translated : {}
}

/** Whether a public page in `locale` shows the record in that language. */
export function catalogLocaleTranslated(
  record: ContentCatalogRecord,
  locale: string
): boolean {
  if (!['model', 'workflow', 'app'].includes(String(record.data.type)))
    return locale === 'en'
  const source =
    typeof record.data.source_locale === 'string'
      ? record.data.source_locale
      : 'en'
  if (locale === source) return true
  const doc = jsonObject.safeParse(record.data)
  return (
    doc.success &&
    localizedDocument(doc.data, locale, false).review_state === 'reviewed'
  )
}

function displayText(d: Document, local: Document, key: string, fallback = '') {
  if (typeof local[key] === 'string') return local[key]
  return typeof d[key] === 'string' ? d[key] : fallback
}

// A media input bound as a cloud asset uploads that binding's media kind.
function uploadKind(d: Document, name: string, hints: Document) {
  const binding = objectPresentation(objectPresentation(d.inputBindings)[name])
  return hints.control === 'media' &&
    !('urlUpload' in hints) &&
    binding.encoding === 'cloud-asset' &&
    typeof binding.mediaKind === 'string'
    ? { urlUpload: binding.mediaKind }
    : {}
}

function inputContract(d: Document) {
  const schema = objectPresentation(d.inputSchema)
  const inputs = Object.fromEntries(
    Object.entries(objectPresentation(d.inputs)).map(([name, raw]) => {
      const hints = jsonObject.safeParse(raw)
      return [
        name,
        hints.success
          ? {
              help: '',
              hidden: false,
              advanced: false,
              ...hints.data,
              ...uploadKind(d, name, hints.data)
            }
          : raw
      ]
    })
  )
  return {
    inputSchema: {
      ...schema,
      type: 'object',
      properties: schema.properties ?? {},
      required: schema.required ?? [],
      additionalProperties: false
    },
    inputs
  }
}

function authorDetails(d: Document, locale: string) {
  const resolved = objectPresentation(d.website_author)
  const matches =
    typeof d.author_uid === 'string' && resolved.uid === d.author_uid
  const name = matches ? trimmedText(resolved.name) : undefined
  const unavailable =
    typeof d.author_uid === 'string' && d.author_uid.trim()
      ? translationsFor(resolveLocale(locale)).t(
          'cccWorkflow.authorUnavailable'
        )
      : undefined
  return {
    author: name ?? unavailable,
    ...authorAvatar(matches, resolved.avatar_url)
  }
}

function trimmedText(value: unknown) {
  return typeof value === 'string' ? value.trim() || undefined : undefined
}

function authorAvatar(matches: boolean, value: unknown) {
  return matches && typeof value === 'string' && validAuthorAvatarURL(value)
    ? { authorAvatarURL: value }
    : {}
}

function validURL(value: unknown, validate: (value: string) => boolean) {
  return typeof value === 'string' && validate(value) ? value : undefined
}

function mediaKind(types: Document, field: string) {
  const mime = types[field]
  if (mime === 'video/mp4' || mime === 'video/webm') return 'video'
  if (mime === 'image/png' || mime === 'image/jpeg' || mime === 'image/webp')
    return 'image'
  if (typeof mime === 'string' && mime.startsWith('audio/')) return 'audio'
  return undefined
}

function workflowVersionFile(
  d: Document,
  urls: Document,
  role: 'api' | 'download'
) {
  if (!Array.isArray(d.workflow_versions)) return undefined
  const version = objectPresentation(d.workflow_versions[0])
  const file = objectPresentation(version[role])
  const href = urls[`$.workflow_versions[0].${role}`]
  if (typeof href !== 'string' || !validWorkflowDownloadURL(href))
    return undefined
  return {
    name: typeof version.name === 'string' ? version.name : 'V1',
    uid: file.id,
    version: file.file_version_uid,
    href
  }
}

function workflowFiles(d: Document, urls: Document) {
  if (Array.isArray(d.workflow_versions)) {
    const file = workflowVersionFile(d, urls, 'download')
    return file ? [file] : []
  }
  if (!Array.isArray(d.workflow_files)) return undefined
  return d.workflow_files.flatMap((raw, index) => {
    const entry = objectPresentation(raw)
    const file = objectPresentation(entry.file)
    const href = urls[`$.workflow_files[${index}].file`]
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
}

function faqDetails(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.flatMap((raw: unknown, index) => {
    const { question, answer } = objectPresentation(raw)
    if (
      typeof question !== 'string' ||
      !question.trim() ||
      typeof answer !== 'string' ||
      !answer.trim()
    )
      return []
    return [
      {
        id: `catalog-faq-${index}`,
        question: question.trim(),
        answer: answer.trim()
      }
    ]
  })
}

function modelLinkName(
  resource: ContentCatalogRecord | undefined,
  label: Document | undefined,
  locale: string,
  preview: boolean
) {
  const translation = objectPresentation(
    objectPresentation(resource?.data.translations)[locale]
  )
  const name =
    typeof translation.title === 'string' &&
    (preview || translation.review_state === 'reviewed')
      ? translation.title
      : (label?.title ?? resource?.data.title)
  return typeof name === 'string' && name.trim()
    ? name.trim()
    : translationsFor(resolveLocale(locale)).t('cccWorkflow.modelUnavailable')
}

function modelLinkHref(
  resource: ContentCatalogRecord | undefined,
  label: Document | undefined,
  locale: string
) {
  const href = typeof label?.href === 'string' ? label.href : resource?.slug
  return href && /^\/hub\/models\/[a-z0-9._-]+\/?$/.test(href)
    ? {
        href: `${locale === 'en' ? '' : `/${locale}`}${href.replace(/\/$/, '')}/`
      }
    : {}
}

function modelLinks(
  d: Document,
  resources: readonly ContentCatalogRecord[],
  locale: string,
  preview: boolean
) {
  if (!Array.isArray(d.model_uids)) return []
  const localizedLabels = objectPresentation(d.website_model_labels_localized)[
    locale
  ]
  const labels = [
    ...(Array.isArray(localizedLabels) ? localizedLabels : []),
    ...(Array.isArray(d.website_model_labels) ? d.website_model_labels : [])
  ].map(objectPresentation)
  return d.model_uids.flatMap((uid) => {
    if (typeof uid !== 'string' || !uid.trim()) return []
    const resource = resources.find(
      (candidate) =>
        candidate.uid.toLowerCase() === uid.toLowerCase() &&
        candidate.data.type === 'model' &&
        !candidate.deleted
    )
    const label = labels.find(
      (entry) =>
        typeof entry.uid === 'string' &&
        entry.uid.toLowerCase() === uid.toLowerCase()
    )
    return [
      {
        uid,
        name: modelLinkName(resource, label, locale, preview),
        ...modelLinkHref(resource, label, locale)
      }
    ]
  })
}

function optionalCounter(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined
}

// The Run form needs one input setting per declared property. A mismatch
// shows a notice and no Run form rather than failing the whole page.
function inputMismatch(d: Document) {
  if (d.type !== 'workflow') return undefined
  const names = Object.keys(objectPresentation(d.inputs))
  const declared = Object.keys(
    objectPresentation(objectPresentation(d.inputSchema).properties)
  )
  const undeclared = names.filter((name) => !declared.includes(name))
  const unconfigured = declared.filter((name) => !names.includes(name))
  return undeclared.length || unconfigured.length
    ? {
        undeclared: undeclared.slice(0, 200),
        unconfigured: unconfigured.slice(0, 200)
      }
    : undefined
}

function workflowRunnable(d: Document) {
  if (
    inputMismatch(d) ||
    (Array.isArray(d.workflow_versions) &&
      !Object.keys(objectPresentation(d.website_api_workflow)).length)
  )
    return false
  return typeof d.runnable === 'boolean' ? d.runnable : undefined
}

function workflowDetails(
  d: Document,
  local: Document,
  locale: string,
  preview: boolean,
  resources: readonly ContentCatalogRecord[]
) {
  const urls = objectPresentation(d.website_media)
  return workflowCatalogDetailsSchema.safeParse({
    locale: resolveLocale(locale),
    cloudShareURL: validURL(d.cloud_share_url, validCloudShareURL),
    documentationURL: validURL(d.documentation_url, validDocumentationURL),
    apiWorkflowFile: workflowVersionFile(d, urls, 'api'),
    workflowFiles: workflowFiles(d, urls),
    longDescription:
      displayText(d, local, 'long_description').trim() || undefined,
    faqs: faqDetails(Array.isArray(local.faq) ? local.faq : d.faq),
    worksOnCloud:
      typeof d.works_on_cloud === 'boolean' ? d.works_on_cloud : undefined,
    inputMismatch: inputMismatch(d),
    runnable: workflowRunnable(d),
    scriptCode: d.script_code,
    outputType:
      typeof d.output_type === 'string' && d.output_type.trim()
        ? d.output_type
        : undefined,
    models: modelLinks(d, resources, locale, preview),
    ...authorDetails(d, locale),
    runs: optionalCounter(d.runs),
    downloads: optionalCounter(d.downloads)
  })
}

function examplePresentation(
  raw: unknown,
  index: number,
  urls: Document,
  types: Document
) {
  const example = objectPresentation(raw)
  const field = `$.examples[${index}].media`
  const kind = mediaKind(types, field)
  const url = urls[field]
  return {
    ...objectPresentation(example.presentation),
    name:
      typeof example.name === 'string' ? example.name : `example-${index + 1}`,
    title: typeof example.title === 'string' ? example.title : '',
    description:
      typeof example.description === 'string' ? example.description : '',
    tags: Array.isArray(example.tags) ? example.tags : [],
    values: example.values ?? {},
    ...(kind ? { mediaKind: kind } : {}),
    thumbnailUrl: typeof url === 'string' ? url : ''
  }
}

function heroPoster(urls: Document, staticThumb: string | undefined) {
  if (staticThumb) return { poster: staticThumb, staticUrl: staticThumb }
  return typeof urls['$.hero_poster'] === 'string'
    ? { poster: urls['$.hero_poster'] }
    : {}
}

function staticThumbnail(urls: Document, types: Document) {
  return types['$.static_thumb'] === 'image/webp' &&
    typeof urls['$.static_thumb'] === 'string'
    ? urls['$.static_thumb']
    : undefined
}

function heroKind(urls: Document, types: Document, staticOnly: boolean) {
  if (staticOnly) return 'image'
  return mediaKind(
    types,
    typeof urls['$.hero'] === 'string' ? '$.hero' : '$.thumbnail'
  )
}

function heroPresentation(d: Document, preserved: Document) {
  const urls = objectPresentation(d.website_media)
  const types = objectPresentation(d.website_media_types)
  const originalHero = urls['$.hero'] ?? urls['$.thumbnail']
  const staticThumb = staticThumbnail(urls, types)
  const hero = typeof originalHero === 'string' ? originalHero : staticThumb
  if (typeof hero !== 'string') return {}
  const kind = heroKind(
    urls,
    types,
    typeof originalHero !== 'string' && Boolean(staticThumb)
  )
  const poster = heroPoster(urls, staticThumb)
  const thumbnailUrl = kind === 'audio' ? poster.poster : hero
  return {
    ...(thumbnailUrl ? { thumbnailUrl } : {}),
    thumbnail: {
      url: hero,
      kind: kind ?? preserved.thumbnailKind ?? 'image',
      ...poster
    }
  }
}

function workflowCloud(d: Document, preserved: Document) {
  if (Array.isArray(d.workflow_versions)) {
    const api = objectPresentation(d.website_api_workflow)
    return Object.keys(api).length
      ? { cloud: { workflow: api, inputBindings: d.inputBindings ?? {} } }
      : {}
  }
  return preserved.cloud
    ? {
        cloud: {
          ...objectPresentation(preserved.cloud),
          inputBindings: d.inputBindings ?? {}
        }
      }
    : {}
}

const RUN_OUTPUT_KINDS = ['image', 'video', 'audio']

// Top-level authored outputs in the shape the Run results read; entries the
// website cannot show (3d, text, malformed) are left out.
function runOutputs(raw: unknown) {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((entry) => {
    const { id, nodeId, key, kind } = objectPresentation(entry)
    return typeof id === 'string' &&
      id &&
      typeof nodeId === 'string' &&
      nodeId &&
      typeof key === 'string' &&
      key &&
      typeof kind === 'string' &&
      RUN_OUTPUT_KINDS.includes(kind)
      ? [{ id, nodeId, key, kind }]
      : []
  })
}

// With mismatched inputs the page builds an empty form and shows a notice.
function workflowInputs(d: Document) {
  const contract = inputContract(d)
  return inputMismatch(d)
    ? {
        inputSchema: { ...contract.inputSchema, properties: {}, required: [] },
        inputs: {}
      }
    : contract
}

// Migrated website outputs win; otherwise Run reads the authored outputs.
function workflowOutputs(d: Document, workflow: Document) {
  if ('outputs' in workflow) return {}
  const outputs = runOutputs(d.outputs)
  return outputs.length ? { outputs } : {}
}

function workflowPresentation(
  record: ContentCatalogRecord,
  d: Document,
  preserved: Document,
  details: ReturnType<typeof workflowDetails>
) {
  const workflowId = `workflows/${record.uid}`
  const workflow = { ...objectPresentation(preserved.workflow) }
  const versioned = Array.isArray(d.workflow_versions)
  if (versioned) delete workflow.cloud
  return {
    type: 'CLOUD',
    ...(details.success ? { catalogDetails: details.data } : {}),
    workflowId: preserved.workflowId ?? workflowId,
    workflow: {
      ...workflow,
      id: workflow.id ?? workflowId,
      definitionVersion: versioned
        ? record.edit_version
        : (workflow.definitionVersion ?? record.edit_version),
      ...workflowInputs(d),
      ...workflowCloud(d, workflow),
      ...workflowOutputs(d, workflow)
    }
  }
}

function contentPresentation(
  record: ContentCatalogRecord,
  d: Document,
  preserved: Document,
  details: ReturnType<typeof workflowDetails>
) {
  if (d.type === 'workflow')
    return workflowPresentation(record, d, preserved, details)
  if (d.type === 'app') return { type: 'APP', appId: d.implementation_ref }
  if (d.type !== 'model') return {}
  const routerId = trimmedText(d.router_model_id)
  if (!routerId)
    return {
      type: 'MODEL',
      routerId: undefined,
      execution: undefined,
      ...(details.success ? { catalogDetails: details.data } : {})
    }
  return {
    type: 'MODEL',
    routerId,
    ...(preserved.execution
      ? {
          execution: {
            ...objectPresentation(preserved.execution),
            ...inputContract(d)
          }
        }
      : {})
  }
}

function catalogUseCases(d: Document) {
  const authored = d.use_cases
  if (d.type === 'model' && Array.isArray(authored))
    return {
      useCases: USE_CASES.filter((value) => authored.includes(value))
    }
  return typeof d.generation_type === 'string'
    ? { useCases: [d.generation_type] }
    : {}
}

function labelNames(value: unknown, key: string) {
  if (!Array.isArray(value)) return []
  return value.flatMap((raw) => {
    const name = trimmedText(objectPresentation(raw)[key])
    return name ? [name] : []
  })
}

function workflowRunsOn(d: Document, preserved: Document) {
  if (d.type !== 'workflow' || Array.isArray(preserved.models)) return {}
  const linked = labelNames(d.website_model_labels, 'title')
  const names = linked.length
    ? linked
    : labelNames(d.model_labels, 'display_name')
  return names.length ? { models: [...new Set(names)] } : {}
}

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
  const preserved = objectPresentation(
    objectPresentation(d.compatibility).website
  )
  const local = localizedDocument(d, locale, preview)
  const urls = objectPresentation(d.website_media)
  const types = objectPresentation(d.website_media_types)
  const details = workflowDetails(d, local, locale, preview, resources)
  return {
    ...preserved,
    fields: preserved.fields ?? [],
    defaults: preserved.defaults ?? {},
    examples: Array.isArray(d.examples)
      ? d.examples.map((raw, index) =>
          examplePresentation(raw, index, urls, types)
        )
      : [],
    ...heroPresentation(d, preserved),
    slug:
      preserved.slug ??
      (d.type === 'workflow' ? `workflows/${String(d.slug)}` : d.slug),
    name: displayText(d, local, 'title', record.uid),
    summary: displayText(d, local, 'description'),
    href: `${record.slug}/`,
    workflowCount: preserved.workflowCount ?? 0,
    capabilities: Array.isArray(local.tags)
      ? local.tags
      : Array.isArray(d.tags)
        ? d.tags
        : [],
    ...catalogUseCases(d),
    ...workflowRunsOn(d, preserved),
    ...(typeof d.provider === 'string' ? { provider: d.provider } : {}),
    ...contentPresentation(record, d, preserved, details)
  }
}
