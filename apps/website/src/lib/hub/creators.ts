import { z } from 'zod'

const namedSchema = z.object({ display_name: z.string() })

export const hubCreatorWorkflowSchema = z.object({
  share_id: z.string(),
  name: z.string(),
  status: z.string(),
  is_app: z.boolean(),
  publish_time: z.string(),
  thumbnail_type: z.string().optional(),
  thumbnail_url: z.string().optional(),
  thumbnail_comparison_url: z.string().optional(),
  tags: z.array(namedSchema).optional(),
  models: z.array(namedSchema).optional(),
  profile: z.object({ username: z.string() })
})

export const hubCreatorProfileSchema = z.object({
  username: z.string(),
  display_name: z.string().optional(),
  description: z.string().optional(),
  avatar_url: z.string().optional(),
  website_urls: z.array(z.string()).optional()
})

export const hubCreatorsSnapshotSchema = z.object({
  fetched_at: z.string(),
  profiles: z.array(hubCreatorProfileSchema),
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

const isWebUrl = (url: string) =>
  URL.canParse(url) && /^https?:$/.test(new URL(url).protocol)

const HUB_ASSETS_HOST = 'comfy-hub-assets.comfy.org'

function hubAsset(url: string, transform: string) {
  if (!URL.canParse(url)) return undefined
  const { protocol, hostname, origin, pathname } = new URL(url)
  return protocol === 'https:' && hostname === HUB_ASSETS_HOST
    ? `${origin}/cdn-cgi/${transform}${pathname}`
    : undefined
}

const resizedImage = (width: number) =>
  `image/width=${width},format=auto,quality=82`

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
