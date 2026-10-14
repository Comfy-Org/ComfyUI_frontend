import type { ContentCatalogRecord } from '@comfyorg/ingest-types'

export type Placement = 'basic' | 'advanced' | 'hidden'
export type MediaKind = 'image' | 'video' | 'audio'
type Kind = ContentCatalogRecord['kind']
type Data = Record<string, unknown>

export interface EditorExample {
  title: string
  description: string
  prompt: string
  media: string
  mediaKind: MediaKind
  raw: Data
}

export interface EditorParameter {
  name: string
  type: string
  description: string
  options: string[]
  required: boolean
  defaultValue: string
  placement: Placement
}

/** The Hub's use-case filters, in the order the catalogue shows them. */
export const EDITOR_USE_CASES = [
  'generate-images',
  'edit-images',
  'generate-videos',
  'animate-images',
  'edit-videos',
  'text',
  '3d',
  'audio'
] as const
export type EditorUseCase = (typeof EDITOR_USE_CASES)[number]

export interface EditorFaq {
  question: string
  answer: string
}

export interface EditorState {
  uid: string
  kind: Kind
  slug: string
  isNew: boolean
  name: string
  summary: string
  credit: string
  tags: string
  translation: { name: string; summary: string }
  cover: { url: string; kind: MediaKind }
  enabled: boolean
  visibility: 'PUBLIC' | 'STAFF'
  visibleFrom: string
  deleted: boolean
  examples: EditorExample[]
  parameters: EditorParameter[]
  useCases: EditorUseCase[]
  faq: EditorFaq[]
  /** Workflows only: whether it runs on the Hub or only downloads as a node graph. */
  runsOnHub: boolean
}

const object = (value: unknown): Data =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Data)
    : {}
const text = (value: unknown) => (typeof value === 'string' ? value : '')
const mediaKind = (value: unknown): MediaKind =>
  value === 'video' || value === 'audio' ? value : 'image'

export const HUB_SECTION: Record<Kind, string> = {
  MODEL: 'models',
  WORKFLOW: 'workflows',
  APP: 'apps'
}

export function slugify(value: string) {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export function pageSlug(kind: Kind, name: string) {
  return `/hub/${HUB_SECTION[kind]}/${slugify(name)}`
}

/** The JSON schema the playground form is built from, if the item has one. */
function inputSchema(data: Data) {
  const source =
    object(data.execution).inputSchema ?? object(data.workflow).inputSchema
  return object(source)
}

function shownDefault(value: unknown) {
  if (value === undefined || value === null) return ''
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

function defaultPlacement(name: string, required: boolean): Placement {
  return required || name === 'prompt' ? 'basic' : 'advanced'
}

function editorParameters(data: Data): EditorParameter[] {
  const schema = inputSchema(data)
  const required = new Set(
    Array.isArray(schema.required) ? schema.required.map(String) : []
  )
  const defaults = object(data.defaults)
  const layout = object(data.formLayout)
  return Object.entries(object(schema.properties)).map(([name, raw]) => {
    const property = object(raw)
    const placement = layout[name]
    return {
      name,
      type: text(property.type) || 'string',
      description: text(property.description),
      options: Array.isArray(property.enum) ? property.enum.map(String) : [],
      required: required.has(name),
      defaultValue: shownDefault(defaults[name] ?? property.default),
      placement:
        placement === 'basic' ||
        placement === 'advanced' ||
        placement === 'hidden'
          ? placement
          : defaultPlacement(name, required.has(name))
    }
  })
}

function editorExample(raw: unknown): EditorExample {
  const example = object(raw)
  return {
    title: text(example.title),
    description: text(example.description),
    prompt: text(example.prompt) || text(object(example.values).prompt),
    media: text(example.thumbnailUrl),
    mediaKind: mediaKind(example.mediaKind),
    raw: example
  }
}

const creditKey = (kind: Kind) =>
  kind === 'MODEL' ? 'provider' : kind === 'WORKFLOW' ? 'author' : undefined

export function editorState(
  record: ContentCatalogRecord,
  isNew = false
): EditorState {
  const data = record.data
  const thumbnail = object(data.thumbnail)
  const translation = object(object(data.translations)['zh-CN'])
  const credit = creditKey(record.kind)
  return {
    uid: record.uid,
    kind: record.kind,
    slug: record.slug,
    isNew,
    name: text(data.name),
    summary: text(data.summary),
    credit: credit ? text(data[credit]) : '',
    tags: (Array.isArray(data.capabilities) ? data.capabilities : []).join(
      ', '
    ),
    translation: {
      name: text(translation.name),
      summary: text(translation.summary)
    },
    cover: {
      url: text(thumbnail.url) || text(data.thumbnailUrl),
      kind: mediaKind(thumbnail.kind)
    },
    enabled: record.enabled,
    visibility: record.visibility,
    visibleFrom: record.visible_from?.slice(0, 16) ?? '',
    deleted: record.deleted,
    examples: (Array.isArray(data.examples) ? data.examples : []).map(
      editorExample
    ),
    parameters: editorParameters(data),
    useCases: (Array.isArray(data.useCases) ? data.useCases : []).filter(
      (useCase): useCase is EditorUseCase =>
        (EDITOR_USE_CASES as readonly unknown[]).includes(useCase)
    ),
    faq: (Array.isArray(data.faq) ? data.faq : []).map((entry) => ({
      question: text(object(entry).question),
      answer: text(object(entry).answer)
    })),
    runsOnHub: data.runsOnHub !== false
  }
}

/** A copy of an existing item to start a new one from, under a new address. */
export function newFromTemplate(
  template: ContentCatalogRecord,
  uid: string
): EditorState {
  return {
    ...editorState(template, true),
    uid,
    name: '',
    summary: '',
    slug: '',
    translation: { name: '', summary: '' },
    faq: [],
    enabled: true,
    visibility: 'PUBLIC',
    visibleFrom: '',
    deleted: false
  }
}

function typedDefault(parameter: EditorParameter): unknown {
  const value = parameter.defaultValue.trim()
  if (parameter.type === 'integer' || parameter.type === 'number') {
    const number = Number(value)
    return Number.isFinite(number) ? number : value
  }
  if (parameter.type === 'boolean') return value === 'true'
  if (parameter.type === 'object' || parameter.type === 'array') {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }
  return value
}

function savedExample(example: EditorExample): Data {
  const values = object(example.raw.values)
  return {
    ...example.raw,
    title: example.title,
    description: example.description,
    thumbnailUrl: example.media,
    mediaKind: example.mediaKind,
    ...(example.prompt
      ? {
          prompt: example.prompt,
          values: { ...values, prompt: example.prompt }
        }
      : {})
  }
}

function sectionSlug(state: EditorState, base: Data) {
  if (!state.isNew) return base.slug
  const last = state.slug.split('/').pop() ?? ''
  return state.kind === 'MODEL' ? last : `${HUB_SECTION[state.kind]}/${last}`
}

function savedFaq(faq: EditorFaq[]) {
  const entries = faq
    .map((entry) => ({
      question: entry.question.trim(),
      answer: entry.answer.trim()
    }))
    .filter((entry) => entry.question && entry.answer)
  return entries.length ? entries : undefined
}

function savedData(state: EditorState, base: Data): Data {
  const credit = creditKey(state.kind)
  const translation =
    state.translation.name || state.translation.summary
      ? { 'zh-CN': { ...state.translation } }
      : undefined
  const parameters = state.parameters
  const defaults = Object.fromEntries(
    parameters
      .filter((parameter) => parameter.defaultValue.trim() !== '')
      .map((parameter) => [parameter.name, typedDefault(parameter)])
  )
  return {
    ...base,
    name: state.name.trim(),
    summary: state.summary.trim(),
    ...(credit ? { [credit]: state.credit.trim() || undefined } : {}),
    capabilities: state.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    translations: translation,
    thumbnail: {
      ...object(base.thumbnail),
      url: state.cover.url.trim(),
      kind: state.cover.kind
    },
    thumbnailUrl: state.cover.url.trim(),
    examples: state.examples.map(savedExample),
    useCases: state.useCases.length ? state.useCases : undefined,
    faq: savedFaq(state.faq),
    runsOnHub: state.kind === 'WORKFLOW' ? state.runsOnHub : undefined,
    ...(parameters.length
      ? {
          defaults: { ...object(base.defaults), ...defaults },
          formLayout: Object.fromEntries(
            parameters.map((parameter) => [parameter.name, parameter.placement])
          )
        }
      : {}),
    slug: sectionSlug(state, base),
    href: `${state.slug}/`,
    ...(state.isNew ? { legacy_id: undefined } : {})
  }
}

/** The record the site API saves into the draft. */
export function savedRecord(state: EditorState, base: Data) {
  return {
    kind: state.kind,
    slug: state.slug,
    enabled: state.enabled,
    visibility: state.visibility,
    ...(state.visibleFrom
      ? { visible_from: new Date(`${state.visibleFrom}:00Z`).toISOString() }
      : {}),
    deleted: state.deleted,
    data: JSON.parse(JSON.stringify(savedData(state, base))) as Data
  }
}

export function editorProblems(state: EditorState) {
  const problems: Array<'name' | 'slug' | 'cover'> = []
  if (!state.name.trim()) problems.push('name')
  if (
    !/^\/hub\/(models|workflows|apps)\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
      state.slug
    )
  )
    problems.push('slug')
  if (!state.cover.url.trim()) problems.push('cover')
  return problems
}
