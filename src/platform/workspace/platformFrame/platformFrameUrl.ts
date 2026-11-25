import { parseUrl } from '@comfyorg/shared-frontend-utils/urlSafety'

import { getComfyPlatformBaseUrl } from '@/config/comfyApi'

type PlatformFrameStep =
  | 'new'
  | 'update'
  | 'nodes'
  | 'models'
  | 'preinstall'
  | 'follow'

export interface PlatformFrameRequest {
  step: PlatformFrameStep
  startAtNodes?: boolean
  deploymentId?: string
  handsOverWorkflow?: boolean
  releaseId?: string
  version?: number
}

export function platformFrameOrigin(): string | null {
  const url = parseUrl(getComfyPlatformBaseUrl())
  return url && (url.protocol === 'https:' || url.protocol === 'http:')
    ? url.origin
    : null
}

function platformBase(): string {
  return getComfyPlatformBaseUrl().replace(/\/+$/, '')
}

export function platformFrameUrl(
  request: PlatformFrameRequest,
  workspaceId: string | null
): string {
  const url = new URL(`${platformBase()}/embed/custom-deployment`)
  url.searchParams.set('step', request.step)
  if (request.step === 'new' && request.startAtNodes)
    url.searchParams.set('start', 'nodes')
  if (workspaceId) url.searchParams.set('workspace', workspaceId)
  if (request.deploymentId)
    url.searchParams.set('deployment', request.deploymentId)
  if (request.step === 'follow' && request.releaseId) {
    url.searchParams.set('release', request.releaseId)
    if (request.version)
      url.searchParams.set('version', String(request.version))
  }
  url.searchParams.set('parent', window.location.origin)
  return url.href
}

export function platformVersionPageUrl(
  version: { buildId: string; releaseId: string; workspaceId: string | null },
  section?: 'deployments'
): string {
  const build = encodeURIComponent(version.buildId)
  const release = encodeURIComponent(version.releaseId)
  const url = new URL(
    `${platformBase()}/profile/builds/${build}/releases/${release}`
  )
  if (version.workspaceId)
    url.searchParams.set('workspace', version.workspaceId)
  if (section) url.hash = section
  return url.href
}
