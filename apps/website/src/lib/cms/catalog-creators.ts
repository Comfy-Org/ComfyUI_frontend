import { z } from 'zod'

import type { HubCreator, HubCreatorSummary } from '@/lib/hub/creators'
import { hubAvatarUrl, isHttpsUrl } from '@/lib/hub/creators'
import {
  CREATOR_USERNAME_MAX,
  hubCreatorPath,
  isCreatorUsername
} from '@/lib/hub/creator-path'
import type { AuthoringSession } from './authoring-session'
import { loadSiteCatalogList } from './catalog-list'
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

const creatorProfileSchema = z.object({
  username: z.string().min(1).max(CREATOR_USERNAME_MAX),
  display_name: text,
  bio: z.string().max(5000).nullish(),
  avatar_url: text,
  links: z
    .array(z.object({ label: text, url: z.string().max(2048) }))
    .max(20)
    .nullish()
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

function creatorFromProfile(
  profile: z.output<typeof creatorProfileSchema>
): HubCreator {
  const avatarUrl = hubAvatarUrl(profile.avatar_url)
  return {
    username: profile.username.toLowerCase(),
    displayName: profile.display_name || profile.username,
    ...(profile.bio && { description: profile.bio }),
    ...(avatarUrl && { avatarUrl }),
    websiteUrls: (profile.links ?? []).map(({ url }) => url).filter(isHttpsUrl)
  }
}

export async function loadCatalogCreator(
  session: AuthoringSession | undefined,
  locale: string,
  username: string
) {
  const unavailable = { status: 'unavailable' } as const
  const origin = catalogOrigin()
  if (!origin) return unavailable
  if (!isCreatorUsername(username)) return { status: 'missing' } as const
  const read = await fetchCatalogJson(
    new URL(`${CREATORS_PATH}/${encodeURIComponent(username)}`, origin)
  )
  if (read.status === 404) return { status: 'missing' } as const
  const profile = creatorProfileSchema.safeParse(read.data)
  if (!profile.success) return unavailable
  const cards = await loadSiteCatalogList(
    session,
    locale,
    'workflows',
    new URLSearchParams({ author: profile.data.username })
  )
  if (!cards.ok) return unavailable
  return {
    status: 'ok',
    creator: creatorFromProfile(profile.data),
    workflows: cards.models,
    nextCursor: cards.pages.workflows.nextCursor
  } as const
}

/** The profile route's answer: a lowercase redirect, or the creator read. */
export async function loadCreatorPage(
  session: AuthoringSession | undefined,
  locale: string,
  username: string
) {
  if (username !== username.toLowerCase())
    return {
      status: 'redirect',
      location: hubCreatorPath(username, locale)
    } as const
  return loadCatalogCreator(session, locale, username)
}
