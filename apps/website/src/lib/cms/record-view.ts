import { z } from 'astro/zod'
import {
  zGetCccDraftItemResponse,
  zGetCccRevisionItemResponse
} from '@comfyorg/ingest-types/zod'
import type { AuthoringSession } from './authoring-session'
import { authoredDocument, jsonObject } from './editor-document'
import { boundedBody, catalogAuthoring, editorFailure } from './editor-server'
import { catalogReview, readReviewResponse } from './staging-server'
import { reviewTypes } from './staging-review'
import { accountID } from './account-id'
import { hasCatalogCapability } from '@/lib/cms/catalog-capabilities'

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
  if (
    [...query.keys()].some((key) => !['rev', 'version'].includes(key)) ||
    query.getAll('rev').length > 1 ||
    query.getAll('version').length > 1
  )
    return { ok: false as const, response: editorFailure(400) }
  const rev = query.get('rev')
  const version = query.get('version')
  if (
    (rev !== null &&
      (!/^[1-9]\d*$/.test(rev) || !Number.isSafeInteger(Number(rev)))) ||
    (version !== null && (!rev || !z.uuid().safeParse(version).success))
  )
    return { ok: false as const, response: editorFailure(400) }
  const uid = rawUID.toLowerCase()
  const response = await catalogAuthoring(
    session,
    rev
      ? `/api/v1/catalog/revisions/${rev}/items/${uid}`
      : `/api/v1/catalog/draft/items/${uid}`
  )
  if (!response.ok)
    return { ok: false as const, response: editorFailure(response.status) }
  const bytes = await boundedBody(response, 1 << 20)
  if (!bytes) return { ok: false as const, response: editorFailure(503) }
  let raw: unknown
  try {
    raw = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return { ok: false as const, response: editorFailure(503) }
  }
  const flat = (
    rev ? zGetCccRevisionItemResponse : zGetCccDraftItemResponse
  ).safeParse(raw)
  if (!flat.success) return { ok: false as const, response: editorFailure(503) }
  const original = jsonObject.safeParse(raw)
  if (!original.success)
    return { ok: false as const, response: editorFailure(503) }
  const identity = z
    .object({
      uid: z.uuid(),
      owner_uid: accountID,
      author_uid: accountID,
      revision_uid: z.uuid(),
      type: z.enum(reviewTypes),
      is_deleted: z.boolean()
    })
    .safeParse(original.data)
  if (
    !identity.success ||
    identity.data.uid !== uid ||
    identity.data.owner_uid !== session.owner_uid
  )
    return { ok: false as const, response: editorFailure(404) }
  if (version && identity.data.revision_uid !== version.toLowerCase())
    return { ok: false as const, response: editorFailure(409) }
  const document = authoredDocument(original.data)
  if (!document) return { ok: false as const, response: editorFailure(503) }
  const title =
    typeof document.title === 'string'
      ? document.title
      : typeof document.name === 'string'
        ? document.name
        : uid
  const review = await readReviewResponse(
    await catalogReview(session, 'staging', { search: uid })
  )
  const entry =
    review.ok && 'items' in review.snapshot
      ? review.snapshot.items.find(
          (item) =>
            item.content.uid === uid &&
            item.content.revision_uid === identity.data.revision_uid
        )
      : undefined
  let preview = entry?.presentation?.preview
  if (
    !preview &&
    !identity.data.is_deleted &&
    identity.data.type === 'media' &&
    (!rev || Number(rev) === session.state.draft_rev)
  ) {
    const mime = document.mime_type
    const kind = ['image/png', 'image/jpeg', 'image/webp'].includes(
      typeof mime === 'string' ? mime : ''
    )
      ? ('image' as const)
      : mime === 'video/mp4'
        ? ('video' as const)
        : undefined
    if (kind)
      preview = {
        kind,
        src: `/preview-media/${rev ?? session.state.draft_rev}/${uid}/${identity.data.revision_uid}`
      }
  }
  return {
    ok: true as const,
    record: identity.data,
    document,
    title,
    presentation: entry?.presentation,
    preview
  }
}
