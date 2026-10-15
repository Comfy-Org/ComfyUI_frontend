import { z } from 'astro/zod'

import type { SiteSession } from './admin'
import { siteAPI } from './admin'
import type { SaveResult } from './save-item'
import { putItem } from './save-item'

/**
 * One item's saves, newest first. Like staging, this is the only place the
 * admin reads them, so the catalog API's `/items/{uid}/history` and
 * `/draft/items/{uid}/restore` replace these two calls alone.
 */
const saveSchema = z.object({
  edit_version: z.string(),
  saved_at: z.iso.datetime(),
  saved_by: z.string(),
  kind: z.enum(['MODEL', 'WORKFLOW', 'APP']),
  slug: z.string(),
  enabled: z.boolean(),
  visibility: z.enum(['PUBLIC', 'STAFF']),
  visible_from: z.iso.datetime().optional(),
  deleted: z.boolean(),
  data: z.record(z.string(), z.unknown())
})

export interface ItemVersion {
  editVersion: string
  savedAt: string
  savedBy: string
  name?: string
}

async function loadSaves(session: SiteSession, uid: string) {
  const response = await siteAPI(
    `/admin/api/site/items/${uid}/history`,
    session.credential
  )
  if (!response.ok) return undefined
  const parsed = saveSchema.array().safeParse(await response.json())
  return parsed.success ? parsed.data : undefined
}

/** Who saved the item and when, or undefined when the API keeps no history. */
export async function loadVersions(
  session: SiteSession,
  uid: string
): Promise<ItemVersion[] | undefined> {
  const saves = await loadSaves(session, uid)
  return saves?.map((save) => ({
    editVersion: save.edit_version,
    savedAt: save.saved_at,
    savedBy: save.saved_by,
    name: typeof save.data.name === 'string' ? save.data.name : undefined
  }))
}

/** Saves an earlier version of an item as its newest draft edit. */
export async function restoreVersion(
  session: SiteSession,
  uid: FormDataEntryValue | null,
  version: FormDataEntryValue | null
): Promise<SaveResult> {
  if (!session.review.can_edit) return { ok: false, error: 'denied' }
  if (
    typeof uid !== 'string' ||
    !session.review.draft.items.some((item) => item.uid === uid)
  )
    return { ok: false, error: 'invalid' }
  const saves = await loadSaves(session, uid)
  const source = saves?.find((save) => save.edit_version === version)
  if (!source) return { ok: false, error: 'invalid' }
  const { kind, slug, enabled, visibility, visible_from, deleted, data } =
    source
  return putItem(session, uid, {
    kind,
    slug,
    enabled,
    visibility,
    ...(visible_from ? { visible_from } : {}),
    deleted,
    data
  })
}
