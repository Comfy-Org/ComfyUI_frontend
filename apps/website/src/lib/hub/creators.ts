import { validAuthorAvatarURL } from '@/config/workflow-catalog-details'
import { creatorEntityId } from '@/lib/hub/creator-path'
import { cutAtWord } from '@/lib/workshop/model-meta-description'
import type { JsonLdNode } from '@/utils/jsonLd'
import { organizationId } from '@/utils/jsonLd'

export interface HubCreatorSummary {
  readonly username: string
  readonly displayName: string
  readonly avatarUrl?: string
  readonly workflowCount: number
}

export interface HubCreator {
  readonly username: string
  readonly displayName: string
  readonly description?: string
  readonly avatarUrl?: string
  readonly websiteUrls: readonly string[]
}

const META_DESCRIPTION_MAX = 160
const ORGANIZATION_CREATORS = new Set(['comfyui'])
const HUB_ASSETS_HOST = 'comfy-hub-assets.comfy.org'

export function isHttpsUrl(url: string) {
  return URL.canParse(url) && new URL(url).protocol === 'https:'
}

export function hubAvatarUrl(url: string | null | undefined) {
  if (!url || !validAuthorAvatarURL(url)) return undefined
  const { hostname, origin, pathname } = new URL(url)
  return hostname === HUB_ASSETS_HOST
    ? `${origin}/cdn-cgi/image/width=400,format=auto,quality=82${pathname}`
    : undefined
}

export function creatorEntityNode(
  creator: HubCreator,
  url: string,
  siteUrl: string
): JsonLdNode {
  const isOrganization = ORGANIZATION_CREATORS.has(creator.username)
  const sameAs = [
    ...(isOrganization ? [organizationId(siteUrl)] : []),
    ...creator.websiteUrls
  ]
  return {
    '@type': isOrganization ? 'Organization' : 'Person',
    '@id': creatorEntityId(siteUrl, creator.username),
    name: creator.displayName,
    alternateName: creator.username,
    url,
    ...(creator.description && { description: creator.description }),
    ...(creator.avatarUrl && { image: creator.avatarUrl }),
    ...(sameAs.length > 0 && { sameAs })
  }
}

export function creatorMetaDescription(summary: string, bio?: string) {
  const text = [summary, bio]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > META_DESCRIPTION_MAX
    ? cutAtWord(text, META_DESCRIPTION_MAX)
    : text
}
