import { validAuthorAvatarURL } from '@/config/workflow-catalog-details'

export interface HubCreatorSummary {
  readonly username: string
  readonly displayName: string
  readonly avatarUrl?: string
  readonly workflowCount: number
}

const HUB_ASSETS_HOST = 'comfy-hub-assets.comfy.org'

export function hubAvatarUrl(url: string | null | undefined) {
  if (!url || !validAuthorAvatarURL(url)) return undefined
  const { hostname, origin, pathname } = new URL(url)
  return hostname === HUB_ASSETS_HOST
    ? `${origin}/cdn-cgi/image/width=400,format=auto,quality=82${pathname}`
    : undefined
}
