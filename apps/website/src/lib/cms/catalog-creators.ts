import { z } from 'zod'

import type { HubCreatorSummary } from '@/lib/hub/creators'
import { hubAvatarUrl } from '@/lib/hub/creators'
import { cmsEnabled } from './cms-enabled'
import { boundedBody } from './editor-server'

const CREATORS_PATH = '/api/v1/catalog/creators'
const DIRECTORY_PAGE_LIMIT = 100
const MAX_DIRECTORY_PAGES = 20

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

async function readCatalogJson(url: URL) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(5000),
    cache: 'no-store'
  })
  if (!response.ok) {
    await response.body?.cancel()
    return { status: response.status } as const
  }
  const bytes = await boundedBody(response, 1 << 20)
  if (!bytes) return { status: 502 } as const
  const data: unknown = JSON.parse(new TextDecoder().decode(bytes))
  return { status: response.status, data } as const
}

function catalogOrigin() {
  const origin = process.env.SITE_CATALOG_API_URL
  return origin && cmsEnabled() ? origin : undefined
}

function mergedByUsername(items: z.output<typeof creatorsPageSchema>['items']) {
  const creators = new Map<string, HubCreatorSummary>()
  for (const item of items) {
    const username = item.username.toLowerCase()
    const known = creators.get(username)
    const avatarUrl = known?.avatarUrl ?? hubAvatarUrl(item.avatar_url)
    creators.set(username, {
      username,
      displayName: known?.displayName ?? (item.display_name || item.username),
      workflowCount: (known?.workflowCount ?? 0) + item.workflow_count,
      ...(avatarUrl && { avatarUrl })
    })
  }
  return [...creators.values()]
    .filter(({ workflowCount }) => workflowCount > 0)
    .sort(
      (a, b) =>
        b.workflowCount - a.workflowCount ||
        a.username.localeCompare(b.username)
    )
}

export async function loadCatalogCreators() {
  const unavailable = { ok: false, status: 503 } as const
  const origin = catalogOrigin()
  if (!origin) return unavailable
  const items: z.output<typeof creatorsPageSchema>['items'] = []
  const visited = new Set<string>()
  let cursor: string | undefined
  try {
    for (let page = 0; page < MAX_DIRECTORY_PAGES; page++) {
      const url = new URL(CREATORS_PATH, origin)
      url.searchParams.set('limit', String(DIRECTORY_PAGE_LIMIT))
      if (cursor) url.searchParams.set('cursor', cursor)
      const parsed = creatorsPageSchema.safeParse(
        (await readCatalogJson(url)).data
      )
      if (!parsed.success) return unavailable
      items.push(...parsed.data.items)
      cursor = parsed.data.next_cursor ?? undefined
      if (!cursor)
        return { ok: true, creators: mergedByUsername(items) } as const
      if (visited.has(cursor)) return unavailable
      visited.add(cursor)
    }
  } catch {
    return unavailable
  }
  return unavailable
}
