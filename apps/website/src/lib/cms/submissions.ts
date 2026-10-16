import type { SiteSubmission } from '@comfyorg/ingest-types'
import { zSiteSubmission } from '@comfyorg/ingest-types/zod'

import type { SiteSession } from './admin'
import { siteAPI } from './admin'

/** Workflow submissions waiting for review, or undefined when the API can't say. */
export async function loadSubmissions(
  session: SiteSession
): Promise<SiteSubmission[] | undefined> {
  const response = await siteAPI(
    '/admin/api/site/submissions',
    session.credential
  )
  if (!response.ok) return undefined
  const parsed = zSiteSubmission.array().safeParse(await response.json())
  return parsed.success ? parsed.data : undefined
}
