import { z } from 'zod'

import type { HubCreatorSummary } from '@/lib/hub/creators'
import { hubAvatarUrl } from '@/lib/hub/creators'
import { cmsEnabled } from './cms-enabled'
import { fetchCatalogJson } from './catalog'
import { everyCursorPage } from './catalog-list-all'

const CREATORS_PATH = '/api/v1/catalog/creators'
const DIRECTORY_PAGE_LIMIT = 100
const MAX_DIRECTORY_PAGES = 20
const DIRECTORY_DEADLINE_MS = 8000

const text = z.string().max(4096).nullish()

const creatorsPageSchema = z.object({
  items: z
    .array(
      z.object({
        username: z.string().min(1).max(64),
        display_name: text,
        avatar_url: text,
        workflow_count: z.int().nonnegative()
      })
    )
    .max(DIRECTORY_PAGE_LIMIT),
  next_cursor: text
})

function catalogOrigin() {
  const origin = process.env.SITE_CATALOG_API_URL
  return origin && cmsEnabled() ? origin : undefined
}

type DirectoryItem = z.output<typeof creatorsPageSchema>['items'][number]

function summaryOf(item: DirectoryItem): HubCreatorSummary {
  const avatarUrl = hubAvatarUrl(item.avatar_url)
  return {
    username: item.username,
    displayName: item.display_name || item.username,
    workflowCount: item.workflow_count,
    ...(avatarUrl && { avatarUrl })
  }
}

function busiestFirst(a: HubCreatorSummary, b: HubCreatorSummary) {
  return (
    b.workflowCount - a.workflowCount || a.username.localeCompare(b.username)
  )
}

function directoryOf(items: readonly DirectoryItem[]) {
  return items
    .map(summaryOf)
    .filter(({ workflowCount }) => workflowCount > 0)
    .sort(busiestFirst)
}

export async function loadCatalogCreators(
  deadline = AbortSignal.timeout(DIRECTORY_DEADLINE_MS)
) {
  const unavailable = { ok: false, status: 503 } as const
  const origin = catalogOrigin()
  if (!origin) return unavailable
  const items = await everyCursorPage(async (cursor, pageNumber) => {
    const url = new URL(CREATORS_PATH, origin)
    url.searchParams.set('limit', String(DIRECTORY_PAGE_LIMIT))
    if (cursor) url.searchParams.set('cursor', cursor)
    const page = creatorsPageSchema.safeParse(
      (await fetchCatalogJson(url, undefined, deadline)).data
    )
    if (!page.success) return undefined
    return {
      items: page.data.items,
      nextCursor:
        pageNumber < MAX_DIRECTORY_PAGES
          ? (page.data.next_cursor ?? undefined)
          : undefined
    }
  })
  return items
    ? ({ ok: true, creators: directoryOf(items) } as const)
    : unavailable
}
