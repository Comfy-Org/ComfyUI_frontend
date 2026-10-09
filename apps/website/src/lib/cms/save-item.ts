import { z } from 'astro/zod'

import { modelSchema } from '@/config/models-catalogue-data'
import { detailSchema } from '@/config/models-page-data'

import type { SiteSession } from './admin'
import { siteAPI } from './admin'

export type SaveError = 'denied' | 'invalid' | 'conflict' | 'failed'
export type SaveResult = { ok: true } | { ok: false; error: SaveError }

const savedRecordSchema = z.object({
  kind: z.enum(['MODEL', 'WORKFLOW', 'APP']),
  slug: z
    .string()
    .regex(/^\/hub\/(models|workflows|apps)\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
  enabled: z.boolean(),
  visibility: z.enum(['PUBLIC', 'STAFF']),
  visible_from: z.iso.datetime().optional(),
  deleted: z.boolean(),
  data: z.record(z.string(), z.unknown())
})

function parseRecord(raw: FormDataEntryValue | null) {
  try {
    return savedRecordSchema.safeParse(JSON.parse(String(raw ?? '')))
  } catch {
    return undefined
  }
}

/** The site renders every draft item, so one it can't read breaks the whole preview. */
function renderable(record: z.infer<typeof savedRecordSchema>) {
  if (record.data.href !== `${record.slug}/`) return false
  if (!modelSchema.safeParse(record.data).success) return false
  return record.kind === 'APP' || detailSchema.safeParse(record.data).success
}

/** Saves one item into the draft through the site API's item endpoint. */
export async function saveDraftItem(
  session: SiteSession,
  uid: FormDataEntryValue | null,
  raw: FormDataEntryValue | null
): Promise<SaveResult> {
  if (!session.review.can_edit) return { ok: false, error: 'denied' }
  const record = parseRecord(raw)
  if (
    typeof uid !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      uid
    ) ||
    !record?.success ||
    !renderable(record.data)
  )
    return { ok: false, error: 'invalid' }
  const current = session.review.draft.items.find((item) => item.uid === uid)
  const taken = session.review.draft.items.some(
    (item) => item.uid !== uid && item.slug === record.data.slug
  )
  if (taken) return { ok: false, error: 'invalid' }
  const response = await siteAPI(
    `/admin/api/site/items/${uid}`,
    session.credential,
    {
      method: 'PUT',
      body: JSON.stringify({
        draft_id: session.review.draft.revision_id,
        ...(current ? { edit_version: current.edit_version } : {}),
        ...record.data
      })
    }
  )
  if (response.ok) return { ok: true }
  return {
    ok: false,
    error: response.status === 409 ? 'conflict' : 'failed'
  }
}
