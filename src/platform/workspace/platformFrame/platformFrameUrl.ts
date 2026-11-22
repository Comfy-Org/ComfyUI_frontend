import { parseUrl } from '@comfyorg/shared-frontend-utils/urlSafety'

import { getComfyPlatformBaseUrl } from '@/config/comfyApi'

export type PlatformFrameStep =
  | 'new'
  | 'update'
  | 'nodes'
  | 'models'
  | 'preinstall'

export interface PlatformFrameRequest {
  step: PlatformFrameStep
  startAtNodes?: boolean
  deploymentId?: string
  handsOverWorkflow?: boolean
}

export function platformFrameOrigin(): string | null {
  const url = parseUrl(getComfyPlatformBaseUrl())
  return url && (url.protocol === 'https:' || url.protocol === 'http:')
    ? url.origin
    : null
}

export function platformFrameUrl(
  request: PlatformFrameRequest,
  workspaceId: string | null
): string {
  const url = new URL(
    `${getComfyPlatformBaseUrl().replace(/\/+$/, '')}/embed/custom-deployment`
  )
  url.searchParams.set('step', request.step)
  if (request.step === 'new' && request.startAtNodes)
    url.searchParams.set('start', 'nodes')
  if (workspaceId) url.searchParams.set('workspace', workspaceId)
  if (request.deploymentId)
    url.searchParams.set('deployment', request.deploymentId)
  url.searchParams.set('parent', window.location.origin)
  return url.href
}
