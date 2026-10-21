import {
  zHubProfile,
  zHubProfileSummary,
  zHubWorkflowSummary,
  zLabelRef
} from '@comfyorg/ingest-types/zod'
import { z } from 'zod'

import { cutAtWord } from '@/lib/workshop/model-meta-description'
import type { JsonLdNode } from '@/utils/jsonLd'
import { jsonLdId, organizationId } from '@/utils/jsonLd'
import type { HubTemplate } from './types'

const labelSchema = zLabelRef.pick({ display_name: true })

const hubCreatorWorkflowSchema = zHubWorkflowSummary
  .pick({
    share_id: true,
    name: true,
    status: true,
    is_app: true,
    thumbnail_type: true,
    thumbnail_url: true,
    thumbnail_comparison_url: true
  })
  .extend({
    publish_time: z.iso.datetime().nullable(),
    tags: z.array(labelSchema).optional(),
    models: z.array(labelSchema).optional(),
    profile: zHubProfileSummary.pick({ username: true })
  })

export const hubCreatorsSnapshotSchema = z.object({
  fetched_at: z.string(),
  profiles: z.array(zHubProfile),
  workflows: z.array(hubCreatorWorkflowSchema)
})

type HubCreatorWorkflow = z.output<typeof hubCreatorWorkflowSchema>
export type HubCreatorsSnapshot = z.output<typeof hubCreatorsSnapshotSchema>

export interface HubCreator {
  readonly username: string
  readonly displayName: string
  readonly description?: string
  readonly avatarUrl?: string
  readonly websiteUrls: readonly string[]
  readonly workflows: readonly HubCreatorWorkflow[]
}

function isWebUrl(url: string) {
  return URL.canParse(url) && /^https?:$/.test(new URL(url).protocol)
}

const META_DESCRIPTION_MAX = 160
export const FIRST_WORKFLOW_PAGE = 24
const ORGANIZATION_CREATORS = new Set(['comfyui'])

const IMAGE_FILE = /\.(png|webp|jpe?g|gif|avif)$/i
const VIDEO_FILE = /\.(mp4|webm|mov)$/i
const HUB_ASSETS_HOST = 'comfy-hub-assets.comfy.org'

function hubAsset(url: string, transform: string) {
  if (!URL.canParse(url)) return undefined
  const { protocol, hostname, origin, pathname } = new URL(url)
  return protocol === 'https:' && hostname === HUB_ASSETS_HOST
    ? `${origin}/cdn-cgi/${transform}${pathname}`
    : undefined
}

function resizedImage(width: number) {
  return `image/width=${width},format=auto,quality=82`
}

function stillImage(url: string, width: number) {
  return hubAsset(url, resizedImage(width)) ?? url
}

export function hubCreators({
  profiles,
  workflows
}: HubCreatorsSnapshot): HubCreator[] {
  const approved = workflows.filter(({ status }) => status === 'approved')
  return profiles
    .map((profile) => {
      const username = profile.username.toLowerCase()
      return {
        username,
        displayName: profile.display_name || profile.username,
        description: profile.description || undefined,
        avatarUrl: profile.avatar_url
          ? hubAsset(profile.avatar_url, resizedImage(400))
          : undefined,
        websiteUrls: (profile.website_urls ?? []).filter(isWebUrl),
        workflows: approved.filter(
          (workflow) => workflow.profile.username.toLowerCase() === username
        )
      }
    })
    .filter((creator) => creator.workflows.length > 0)
    .sort(
      (a, b) =>
        b.workflows.length - a.workflows.length ||
        a.username.localeCompare(b.username)
    )
}

function thumbnailsFor(primary = '', comparison = ''): string[] {
  if (IMAGE_FILE.test(primary))
    return [primary, comparison]
      .filter((url) => IMAGE_FILE.test(url))
      .map((url) => stillImage(url, 640))
  const frame = VIDEO_FILE.test(primary)
    ? hubAsset(primary, 'media/mode=frame,time=1s')
    : undefined
  return frame ? [frame] : []
}

export function creatorWorkflowTemplate(
  workflow: HubCreatorWorkflow
): HubTemplate {
  const thumbnails = thumbnailsFor(
    workflow.thumbnail_url,
    workflow.thumbnail_comparison_url
  )
  return {
    name: workflow.share_id,
    title: workflow.name,
    mediaType: VIDEO_FILE.test(workflow.thumbnail_url ?? '')
      ? 'video'
      : 'image',
    tags: (workflow.tags ?? []).map((tag) => tag.display_name),
    models: (workflow.models ?? []).map((model) => model.display_name),
    logos: [],
    usage: 0,
    date: workflow.publish_time?.slice(0, 10) ?? '',
    thumbnails,
    username: workflow.profile.username,
    isApp: workflow.is_app,
    ...(thumbnails.length > 1 && { thumbnailVariant: 'compareSlider' as const })
  }
}

export const creatorEntityId = (url: string) => jsonLdId(url, 'creator')

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
    '@id': creatorEntityId(url),
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
