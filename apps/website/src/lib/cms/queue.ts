import type {
  ContentCatalogRecord,
  ContentCatalogReview,
  SiteSubmission
} from '@comfyorg/ingest-types'

import { draftChanges } from './admin'
import { contentDiff } from './diff'

export type QueueChange = 'new' | 'updated' | 'removed'

interface FieldGroup {
  field: string
  before?: unknown
  after?: unknown
  added: unknown[]
  removed: unknown[]
}

interface QueueBase {
  id: string
  title: string
  change: QueueChange
  thumbnail?: string
}

export interface CatalogQueueItem extends QueueBase {
  source: 'catalog'
  kind: ContentCatalogRecord['kind']
  slug: string
  provider?: string
  visibleFrom?: string
  fields: FieldGroup[]
}

export interface SubmissionQueueItem extends QueueBase {
  source: 'submission'
  kind: 'WORKFLOW'
  author: string
  submittedAt: string
  shareId: string
  versionId: string
  description: string
  listed: boolean
}

export type QueueItem = CatalogQueueItem | SubmissionQueueItem

function topLevelField(path: string) {
  const match =
    /^\$\.(?:data(?:\.|(?=\[)))?(\["[^"]+"\]|[A-Za-z_$][\w$]*)/.exec(path)
  return match ? match[1].replace(/^\["|"\]$/g, '') : path
}

function fieldValue(record: ContentCatalogRecord | undefined, field: string) {
  if (!record || record.deleted) return undefined
  if (field in record.data) return record.data[field]
  const envelope: Record<string, unknown> = {
    kind: record.kind,
    slug: record.slug,
    enabled: record.enabled,
    visibility: record.visibility,
    visible_from: record.visible_from
  }
  return envelope[field]
}

function groupFields(
  before: ContentCatalogRecord | undefined,
  after: ContentCatalogRecord | undefined
): FieldGroup[] {
  const groups = new Map<string, FieldGroup>()
  for (const change of contentDiff(before, after)) {
    const field = topLevelField(change.path)
    const group = groups.get(field) ?? {
      field,
      before: fieldValue(before, field),
      after: fieldValue(after, field),
      added: [],
      removed: []
    }
    const inArray = /\[\d+\]$/.test(change.path)
    if (inArray && change.action === 'added') group.added.push(change.after)
    if (inArray && change.action === 'removed')
      group.removed.push(change.before)
    groups.set(field, group)
  }
  return [...groups.values()]
}

function changeOf(
  before: ContentCatalogRecord | undefined,
  after: ContentCatalogRecord | undefined
): QueueChange {
  if (!after || after.deleted) return 'removed'
  if (!before || before.deleted) return 'new'
  return 'updated'
}

const text = (value: unknown) => (typeof value === 'string' ? value : undefined)

export function buildQueue(
  review: ContentCatalogReview,
  submissions: SiteSubmission[]
): QueueItem[] {
  const catalog = draftChanges(review).flatMap(
    ({ uid, before, after }): CatalogQueueItem[] => {
      const record = after ?? before
      if (!record) return []
      const fields = groupFields(before, after)
      if (!fields.length) return []
      return [
        {
          source: 'catalog',
          id: uid,
          kind: record.kind,
          change: changeOf(before, after),
          title: text(record.data.name) ?? record.slug,
          slug: record.slug,
          provider: text(record.data.provider),
          thumbnail: text(record.data.thumbnailUrl),
          visibleFrom: after?.deleted ? undefined : after?.visible_from,
          fields
        }
      ]
    }
  )
  const workflows = submissions.map(
    (row): SubmissionQueueItem => ({
      source: 'submission',
      id: row.share_id,
      kind: 'WORKFLOW',
      change: 'new',
      title: row.title,
      author: row.owner_uid,
      submittedAt: row.submitted_at,
      shareId: row.share_id,
      versionId: row.version_id,
      description: row.description,
      listed: row.listed
    })
  )
  return [...catalog, ...workflows]
}

export interface ContentRow {
  uid: string
  kind: ContentCatalogRecord['kind']
  title: string
  slug: string
  provider?: string
  thumbnail?: string
  enabled: boolean
  visibleFrom?: string
  inDraft: boolean
  /** Only in the draft so far: not on the live site yet. */
  isNew: boolean
  /** Archived in the draft, or already gone from the live site. */
  archived: boolean
}

export function contentRows(review: ContentCatalogReview): ContentRow[] {
  const changed = new Set(draftChanges(review).map(({ uid }) => uid))
  const live = new Map(review.live.items.map((item) => [item.uid, item]))
  const draft = new Map(review.draft.items.map((item) => [item.uid, item]))
  return [...new Set([...live.keys(), ...draft.keys()])].flatMap((uid) => {
    const current = draft.get(uid) ?? live.get(uid)
    const shown = live.get(uid) ?? current
    if (!current || !shown) return []
    return [
      {
        uid,
        kind: shown.kind,
        title: text(shown.data.name) ?? shown.slug,
        slug: shown.slug,
        provider: text(shown.data.provider),
        thumbnail: text(shown.data.thumbnailUrl),
        enabled: shown.enabled,
        visibleFrom: shown.visible_from,
        inDraft: changed.has(uid),
        isNew: !live.has(uid),
        archived: current.deleted
      }
    ]
  })
}
