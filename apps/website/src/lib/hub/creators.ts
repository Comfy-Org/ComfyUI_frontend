import {
  zHubProfile,
  zHubProfileSummary,
  zHubWorkflowSummary,
  zLabelRef
} from '@comfyorg/ingest-types/zod'
import { z } from 'zod'

const labelSchema = zLabelRef.pick({ display_name: true })

export const hubCreatorWorkflowSchema = zHubWorkflowSummary
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
