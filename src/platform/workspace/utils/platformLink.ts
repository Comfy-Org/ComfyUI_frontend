import {
  isWorkspaceId,
  withWorkspaceLink
} from '@comfyorg/account-core/workspaceLink'
import { parseUrl } from '@comfyorg/shared-frontend-utils/urlSafety'

import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import type { Distribution } from '@/platform/distribution/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

const PLATFORM_LINK_SOURCE = {
  localhost: 'comfyui',
  desktop: 'comfy_desktop',
  cloud: 'comfy_cloud'
} as const satisfies Record<Distribution, string>

/** The place in the app a link to Platform sits, sent as `utm_content`. */
export type PlatformLinkSurface =
  | 'api-key-form'
  | 'custom-deployment-card'
  | 'deploy-installation-button'
  | 'deploy-setup-card'
  | 'deploy-to-comfy-api-card'
  | 'deployment-build-actions'
  | 'deployment-switcher'
  | 'sign-in-dialog'
  | 'switch-deployment-card'

/** `rel` for a link to Platform: only the Cloud build sends its origin as the referrer. */
export function platformLinkRel(): 'noopener' | 'noopener noreferrer' {
  return __DISTRIBUTION__ === 'cloud' ? 'noopener' : 'noopener noreferrer'
}

/** `window.open` features for a link to Platform, with the same referrer rule as `platformLinkRel`. */
export function platformLinkWindowFeatures(): string {
  return platformLinkRel().replace(' ', ',')
}

function runningBuild(): Distribution {
  return window.__comfyDesktop2 === undefined ? __DISTRIBUTION__ : 'desktop'
}

function tagged(url: URL, surface?: PlatformLinkSurface): URL {
  url.searchParams.set('utm_source', PLATFORM_LINK_SOURCE[runningBuild()])
  url.searchParams.set('utm_medium', 'app')
  if (surface) url.searchParams.set('utm_content', surface)
  return url
}

/** A Platform URL built elsewhere, tagged with this build and `surface`; returned unchanged when it is not a URL. */
export function tagPlatformUrl(
  href: string,
  surface?: PlatformLinkSurface
): string {
  const url = parseUrl(href)
  return url ? tagged(url, surface).href : href
}

function inActiveWorkspace(url: URL): string {
  const workspaceId = useTeamWorkspaceStore().activeWorkspaceId
  if (!workspaceId || !isWorkspaceId(workspaceId)) return url.href
  return withWorkspaceLink(url, workspaceId).href
}

/** A platform URL for `path`, tagged with this build, that opens in the cloud app's active workspace, when there is one, and carries `correlationId` when given. */
export function platformLink(
  path: `/${string}`,
  correlationId?: string
): string {
  const url = tagged(new URL(`${getComfyPlatformBaseUrl()}${path}`))
  if (correlationId) url.searchParams.set('correlation_id', correlationId)
  return inActiveWorkspace(url)
}

/** `platformLink` for a link that sits on `surface`. */
export function platformSurfaceLink(
  path: `/${string}`,
  surface: PlatformLinkSurface
): string {
  return inActiveWorkspace(
    tagged(new URL(`${getComfyPlatformBaseUrl()}${path}`), surface)
  )
}
