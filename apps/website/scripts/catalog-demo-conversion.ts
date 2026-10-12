import { v5 as uuidv5 } from 'uuid'
import { jsonObject } from '@/lib/cms/editor-document'
import type { Document } from '@/lib/cms/editor-document'

type Snapshot = { uid: string; kind: string; slug?: string; data: unknown }
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
  const media: {
    uid: string
    url: string
    name: string
    originating_uid: string
    role: string
  }[] = []
  const mediaIDs = new Set<string>()
  const contents = entries.map((entry) => {
    // JSON serialization strips non-authored undefined fields (e.g. form).
    const d = jsonObject.parse(JSON.parse(JSON.stringify(entry.data)))
    const execution = object(d.execution)
    const workflow = object(d.workflow)
    const cloud = object(workflow.cloud)
    const thumbnail = object(d.thumbnail)
    const slug = entry.slug?.split('/').at(-1)
    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
      throw new Error('Unconvertible source slug')
    const ref = (url: string | undefined, role: string) => {
      if (!url) return undefined
      const filename = new URL(url, 'https://comfy.org').pathname
        .split('/')
        .at(-1)!
      const oldID = filename.match(
        /^([a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12})\./i
      )?.[1]
      const uid =
        oldID ?? uuidv5(`comfy-site-media:${entry.uid}:${role}`, uuidv5.URL)
      const name = `${slug}/${role}-${filename}`.replace(
        /[^a-zA-Z0-9/._-]/g,
        '-'
      )
      if (!mediaIDs.has(uid)) {
        mediaIDs.add(uid)
        media.push({ uid, url, name, originating_uid: entry.uid, role })
      }
      return { src: 'r2', id: uid }
    }
    const inputSchema = execution.inputSchema ??
      workflow.inputSchema ?? {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false
      }
    const inputs = execution.inputs ?? workflow.inputs ?? {}
    const inputBindings = cloud.inputBindings ?? {}
    const examples = (Array.isArray(d.examples) ? d.examples : []).map(
      (raw, index) => {
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
        const collect = (v: unknown) => {
          if (
            typeof v === 'string' &&
            /^https:\/\/(?:media\.comfy\.org|comfy-hub-assets\.comfy\.org)\//.test(
              v
            )
          )
            references.push(
              ref(v, `example-${index}-input-${references.length}`)
            )
          else if (Array.isArray(v)) v.forEach(collect)
          else if (v && typeof v === 'object') Object.values(v).forEach(collect)
        }
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
    )
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
    site.thumbnailKind = thumbnail.kind ?? 'image'
    const document = {
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
      inputSchema,
      inputs,
      examples,
      compatibility: {
        website: site,
        import: {
          original_author_label: d.author ?? null,
          author_resolution: 'UNRESOLVED_LOCAL_DEMO_FIXTURE',
          source_slug: entry.slug,
          legacy_id: d.legacy_id ?? null
        }
      },
      ...(typeof thumbnail.url === 'string'
        ? { hero: ref(thumbnail.url, 'hero') }
        : {}),
      ...(typeof thumbnail.poster === 'string'
        ? { hero_poster: ref(thumbnail.poster, 'hero-poster') }
        : {})
    }
    const authored: Record<string, unknown> = document
    const type = entry.kind.toLowerCase()
    if (type === 'model') {
      authored.router_model_id = d.routerId
      authored.provider = d.provider
      if (d.task) authored.task = d.task
    } else authored.generation_type = d.generation_type
    if (type === 'app') authored.implementation_ref = d.appId
    if (type === 'workflow') {
      authored.inputBindings = inputBindings
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
    return {
      uid: entry.uid,
      type,
      document: jsonObject.parse(JSON.parse(JSON.stringify(authored)))
    }
  })
  return { contents, media }
}
