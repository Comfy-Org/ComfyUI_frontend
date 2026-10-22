import { v5 as uuidv5 } from 'uuid'
import { jsonObject } from '@/lib/cms/editor-document'
import type { Document } from '@/lib/cms/editor-document'

type Snapshot = { uid: string; kind: string; slug?: string; data: unknown }
type Media = {
  uid: string
  url: string
  name: string
  originating_uid: string
  role: string
}
type Reference = (
  url: string | undefined,
  role: string
) => { src: string; id: string } | undefined
function object(value: unknown): Document {
  const parsed = jsonObject.safeParse(value)
  return parsed.success ? parsed.data : {}
}
function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}
export function convertDemoSnapshot(entries: Snapshot[]) {
  const media: Media[] = []
  const mediaIDs = new Set<string>()
  const contents = entries.map((entry) => convertEntry(entry, media, mediaIDs))
  return { contents, media }
}
function convertEntry(entry: Snapshot, media: Media[], mediaIDs: Set<string>) {
  const d = jsonObject.parse(JSON.parse(JSON.stringify(entry.data)))
  const slug = entry.slug?.split('/').at(-1)
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    throw new Error('Unconvertible source slug')
  const ref = mediaReference(entry, slug, media, mediaIDs)
  const authored = contentDocument(entry, d, slug, ref)
  const type = entry.kind.toLowerCase()
  applyKindFields(authored, d, type, ref)
  return {
    uid: entry.uid,
    type,
    document: jsonObject.parse(JSON.parse(JSON.stringify(authored)))
  }
}
function mediaReference(
  entry: Snapshot,
  slug: string,
  media: Media[],
  mediaIDs: Set<string>
): Reference {
  return (url, role) => {
    if (!url) return undefined
    const filename = new URL(url, 'https://comfy.org').pathname
      .split('/')
      .at(-1)!
    const oldID = filename.match(
      /^([a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12})\./i
    )?.[1]
    const uid =
      oldID ?? uuidv5(`comfy-site-media:${entry.uid}:${role}`, uuidv5.URL)
    const name = `${slug}/${role}-${filename}`.replace(/[^a-zA-Z0-9/._-]/g, '-')
    if (!mediaIDs.has(uid)) {
      mediaIDs.add(uid)
      media.push({ uid, url, name, originating_uid: entry.uid, role })
    }
    return { src: 'r2', id: uid }
  }
}
function inputDefinition(d: Document) {
  const execution = object(d.execution)
  const workflow = object(d.workflow)
  const inputSchema = execution.inputSchema ??
    workflow.inputSchema ?? {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false
    }
  const inputs = execution.inputs ?? workflow.inputs ?? {}
  return { inputSchema, inputs }
}
function convertExample(raw: unknown, index: number, ref: Reference) {
  const example = object(raw)
  const {
    name,
    title,
    description,
    tags,
    values,
    thumbnailUrl,
    ...presentation
  } = example
  const references: ReturnType<typeof ref>[] = []
  const collect = collectReferences(ref, references, index)
  collect(values)
  return {
    name,
    title,
    description,
    tags: [...new Set(strings(tags))],
    values: values ?? {},
    presentation,
    ...(typeof thumbnailUrl === 'string'
      ? { media: ref(thumbnailUrl, `example-${index}`) }
      : {}),
    ...(references.length ? { reference_media: references } : {})
  }
}
function collectReferences(
  ref: Reference,
  references: ReturnType<Reference>[],
  index: number
) {
  const collect = (v: unknown) => {
    if (
      typeof v === 'string' &&
      /^https:\/\/(?:media\.comfy\.org|comfy-hub-assets\.comfy\.org)\//.test(v)
    )
      references.push(ref(v, `example-${index}-input-${references.length}`))
    else if (Array.isArray(v)) v.forEach(collect)
    else if (v && typeof v === 'object') Object.values(v).forEach(collect)
  }
  return collect
}
function websiteCompatibility(d: Document) {
  const site = structuredClone(d)
  for (const key of [
    'name',
    'summary',
    'thumbnail',
    'thumbnailUrl',
    'examples',
    'capabilities',
    'generation_type',
    'use_cases',
    'routerId',
    'provider',
    'task',
    'appId',
    'legacy_id'
  ])
    delete site[key]
  if (site.execution) {
    const value = object(site.execution)
    delete value.inputSchema
    delete value.inputs
    site.execution = value
  }
  if (site.workflow) {
    const value = object(site.workflow)
    delete value.inputSchema
    delete value.inputs
    if (value.cloud) {
      const c = object(value.cloud)
      delete c.inputBindings
      value.cloud = c
    }
    site.workflow = value
  }
  site.thumbnailKind = object(d.thumbnail).kind ?? 'image'
  return site
}
function contentDocument(
  entry: Snapshot,
  d: Document,
  slug: string,
  ref: Reference
): Record<string, unknown> {
  const thumbnail = object(d.thumbnail)
  return {
    title: d.name,
    slug,
    description: d.summary ?? '',
    enabled: true,
    visibility: 'public',
    available_surfaces: ['hub'],
    source: `website-demo:${d.legacy_id ?? d.slug}`,
    source_locale: 'en',
    tags: [
      ...new Set(
        strings(d.capabilities)
          .map((x) => x.trim())
          .filter(Boolean)
      )
    ],
    use_cases: d.use_cases ?? [],
    sort_order: d.recommendedRank ?? null,
    ...inputDefinition(d),
    examples: (Array.isArray(d.examples) ? d.examples : []).map((raw, index) =>
      convertExample(raw, index, ref)
    ),
    compatibility: {
      website: websiteCompatibility(d),
      import: {
        original_author_label: d.author ?? null,
        author_resolution: 'UNRESOLVED_LOCAL_DEMO_FIXTURE',
        source_slug: entry.slug,
        legacy_id: d.legacy_id ?? null
      }
    },
    ...heroReferences(thumbnail, ref)
  }
}
function heroReferences(thumbnail: Document, ref: Reference) {
  return {
    ...(typeof thumbnail.url === 'string'
      ? { hero: ref(thumbnail.url, 'hero') }
      : {}),
    ...(typeof thumbnail.poster === 'string'
      ? { hero_poster: ref(thumbnail.poster, 'hero-poster') }
      : {})
  }
}
function applyKindFields(
  authored: Record<string, unknown>,
  d: Document,
  type: string,
  ref: Reference
) {
  if (type === 'model') {
    authored.router_model_id = d.routerId
    authored.provider = d.provider
    if (d.task) authored.task = d.task
  } else authored.generation_type = d.generation_type
  if (type === 'app') authored.implementation_ref = d.appId
  if (type === 'workflow') applyWorkflowFields(authored, d, ref)
}
function applyWorkflowFields(
  authored: Record<string, unknown>,
  d: Document,
  ref: Reference
) {
  const workflow = object(d.workflow)
  authored.inputBindings = object(workflow.cloud).inputBindings ?? {}
  authored.outputs = workflow.outputs ?? []
  const template = object(workflow.template)
  if (typeof template.downloadUrl === 'string')
    authored.workflow_files = [
      {
        name: workflow.definitionVersion ?? 'Initial',
        file: ref(template.downloadUrl, 'workflow-file')
      }
    ]
}
