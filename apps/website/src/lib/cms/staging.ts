import { z } from 'astro/zod'

import type { SiteSession } from './admin'
import { siteAPI } from './admin'
import type { Staging } from './stage-status'
import { STAGE_STATUSES, stageEntrySchema } from './stage-status'

/*
 * The only place the admin talks to review staging, so wiring the catalog
 * API's `/api/v1/catalog/draft/staging` means changing this file alone.
 */
const stagingSchema = z.record(z.string(), stageEntrySchema)

/** Review decisions so far, or undefined when the API keeps none. */
export async function loadStaging(
  session: SiteSession
): Promise<Staging | undefined> {
  const response = await siteAPI('/admin/api/site/staging', session.credential)
  if (!response.ok) return undefined
  const parsed = stagingSchema.safeParse(await response.json())
  return parsed.success ? parsed.data : undefined
}

const decisionSchema = z.object({
  ids: z
    .array(z.string().regex(/^[\w.:-]{1,100}$/))
    .min(1)
    .max(500),
  status: z.enum(STAGE_STATUSES)
})

/** Records one review decision for a set of changes. */
export async function saveStaging(
  session: SiteSession,
  raw: FormDataEntryValue | null
): Promise<{ ok: boolean }> {
  if (!session.review.can_apply) return { ok: false }
  let parsed
  try {
    parsed = decisionSchema.safeParse(JSON.parse(String(raw ?? '')))
  } catch {
    return { ok: false }
  }
  if (!parsed.success) return { ok: false }
  const response = await siteAPI(
    '/admin/api/site/staging',
    session.credential,
    {
      method: 'POST',
      body: JSON.stringify({
        items: parsed.data.ids.map((id) => ({ id, status: parsed.data.status }))
      })
    }
  )
  return { ok: response.ok }
}
