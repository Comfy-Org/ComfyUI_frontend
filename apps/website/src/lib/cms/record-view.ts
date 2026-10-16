import { z } from 'astro/zod'
import {
  zGetCccDraftItemResponse,
  zGetCccRevisionItemResponse
} from '@comfyorg/ingest-types/zod'
import type { AuthoringSession } from './authoring-session'
import { authoredDocument, jsonObject } from './editor-document'
import type { Document } from './editor-document'
import { boundedBody, catalogAuthoring, editorFailure } from './editor-server'
import { catalogReview, readReviewResponse } from './staging-server'
import { reviewTypes } from './staging-review'
import { accountID } from './account-id'
import { hasCatalogCapability } from '@/lib/cms/catalog-capabilities'

const identitySchema = z.object({
  uid: z.uuid(),
  owner_uid: accountID,
  author_uid: accountID,
  revision_uid: z.uuid(),
  type: z.enum(reviewTypes),
  is_deleted: z.boolean()
})
type Identity = z.infer<typeof identitySchema>
function validRevision(rev: string | null) {
  return (
    rev === null ||
    (/^[1-9]\d*$/.test(rev) && Number.isSafeInteger(Number(rev)))
  )
}

function recordQuery(query: URLSearchParams) {
  if (
    [...query.keys()].some((key) => !['rev', 'version'].includes(key)) ||
    query.getAll('rev').length > 1 ||
    query.getAll('version').length > 1
  )
    return undefined
  const rev = query.get('rev')
  const version = query.get('version')
  if (!validRevision(rev)) return undefined
  if (version !== null && (!rev || !z.uuid().safeParse(version).success))
    return undefined
  return { rev, version }
}

function decodeRecord(raw: unknown, historical: boolean) {
  const flat = (
    historical ? zGetCccRevisionItemResponse : zGetCccDraftItemResponse
  ).safeParse(raw)
  if (!flat.success) return undefined
  const original = jsonObject.safeParse(raw)
  if (!original.success) return undefined
  const identity = identitySchema.safeParse(original.data)
  return { original: original.data, identity }
}

async function fetchRecord(
  session: AuthoringSession,
  uid: string,
  rev: string | null
) {
  const response = await catalogAuthoring(
    session,
    rev
      ? `/api/v1/catalog/revisions/${rev}/items/${uid}`
      : `/api/v1/catalog/draft/items/${uid}`
  )
  if (!response.ok) return editorFailure(response.status)
  const bytes = await boundedBody(response, 1 << 20)
  if (!bytes) return editorFailure(503)
  let raw: unknown
  try {
    raw = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return editorFailure(503)
  }
  return decodeRecord(raw, Boolean(rev)) ?? editorFailure(503)
}

function mediaPreview(
  record: Identity,
  document: Document,
  rev: string | null,
  draft: number
) {
  if (
    record.is_deleted ||
    record.type !== 'media' ||
    (rev && Number(rev) !== draft)
  )
    return undefined
  const kind = recordMediaKind(document.mime_type)
  return kind
    ? {
        kind,
        src: `/preview-media/${rev ?? draft}/${record.uid}/${record.revision_uid}`
      }
    : undefined
}
function recordMediaKind(mime: Document[string]) {
  if (typeof mime !== 'string') return undefined
  if (['image/png', 'image/jpeg', 'image/webp'].includes(mime))
    return 'image' as const
  return mime === 'video/mp4' ? ('video' as const) : undefined
}

function recordTitle(document: Document, uid: string) {
  if (typeof document.title === 'string') return document.title
  return typeof document.name === 'string' ? document.name : uid
}

async function recordPresentation(session: AuthoringSession, record: Identity) {
  const review = await readReviewResponse(
    await catalogReview(session, 'staging', { search: record.uid })
  )
  if (!review.ok || !('items' in review.snapshot)) return undefined
  return review.snapshot.items.find(
    (item) =>
      item.content.uid === record.uid &&
      item.content.revision_uid === record.revision_uid
  )?.presentation
}

export async function loadRecordView(
  session: AuthoringSession | undefined,
  rawUID: string | undefined,
  query: URLSearchParams
) {
  if (
    !session ||
    !hasCatalogCapability(session) ||
    !z.uuid().safeParse(rawUID).success ||
    !rawUID
  )
    return { ok: false as const, response: editorFailure(404) }
  const selection = recordQuery(query)
  if (!selection) return { ok: false as const, response: editorFailure(400) }
  const uid = rawUID.toLowerCase()
  const fetched = await fetchRecord(session, uid, selection.rev)
  if (fetched instanceof Response)
    return { ok: false as const, response: fetched }
  const identity = fetched.identity
  if (
    !identity.success ||
    identity.data.uid !== uid ||
    identity.data.owner_uid !== session.owner_uid
  )
    return { ok: false as const, response: editorFailure(404) }
  if (
    selection.version &&
    identity.data.revision_uid !== selection.version.toLowerCase()
  )
    return { ok: false as const, response: editorFailure(409) }
  const document = authoredDocument(fetched.original)
  if (!document) return { ok: false as const, response: editorFailure(503) }
  const presentation = await recordPresentation(session, identity.data)
  return {
    ok: true as const,
    record: identity.data,
    document,
    title: recordTitle(document, uid),
    presentation,
    preview:
      presentation?.preview ??
      mediaPreview(
        identity.data,
        document,
        selection.rev,
        session.state.draft_rev
      )
  }
}
