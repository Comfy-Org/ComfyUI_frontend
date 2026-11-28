import { withWorkspaceLink } from '@comfyorg/account-core/workspaceLink'
import { z } from 'zod'

import {
  getBuildTimeComfyCloudBaseUrl,
  getComfyCloudBaseUrl
} from '@/config/comfyApi'

export const LOCAL_HANDOFF_PARAM = 'from_local'

const READY = 'comfy-local-handoff:ready'
const WORKFLOW = 'comfy-local-handoff:workflow'

export const zLocalHandoffReady = z.object({
  type: z.literal(READY),
  nonce: z.string()
})

export const zLocalHandoffWorkflow = z.object({
  type: z.literal(WORKFLOW),
  nonce: z.string(),
  filename: z.string(),
  workflow: z.unknown()
})

type LocalHandoffReady = z.infer<typeof zLocalHandoffReady>
type LocalHandoffWorkflow = z.infer<typeof zLocalHandoffWorkflow>

export function localHandoffReady(nonce: string): LocalHandoffReady {
  return { type: READY, nonce }
}

export function localHandoffWorkflow(
  nonce: string,
  filename: string,
  workflow: unknown
): LocalHandoffWorkflow {
  return { type: WORKFLOW, nonce, filename, workflow }
}

export function cloudEditorUrl(nonce?: string, workspaceId?: string): string {
  const configured = new URL(getComfyCloudBaseUrl())
  const url = new URL('/', configured)
  for (const override of configured.searchParams.getAll('ff'))
    url.searchParams.append('ff', override)
  if (nonce) url.searchParams.set(LOCAL_HANDOFF_PARAM, nonce)
  return workspaceId ? withWorkspaceLink(url, workspaceId).href : url.href
}

export function trustedCloudHandoffOrigin(): string | undefined {
  try {
    const trusted = new URL(getBuildTimeComfyCloudBaseUrl())
    const configured = new URL(getComfyCloudBaseUrl())
    if (trusted.protocol === 'https:' && configured.origin === trusted.origin)
      return trusted.origin
  } catch {
    return undefined
  }
}

const LOCAL_HOSTNAME =
  /^(localhost|\[::1\]|127(\.\d{1,3}){3}|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2}|[\w-]+\.local)$/

export function isLocalOrigin(origin: string): boolean {
  try {
    const url = new URL(origin)
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      LOCAL_HOSTNAME.test(url.hostname)
    )
  } catch {
    return false
  }
}

const CLOUD_CHECK_HOSTNAMES = new Set(['localhost', '127.0.0.1'])

export function acceptsCloudChecks(origin: string): boolean {
  try {
    const url = new URL(origin)
    return (
      url.protocol === 'http:' &&
      url.port !== '' &&
      CLOUD_CHECK_HOSTNAMES.has(url.hostname)
    )
  } catch {
    return false
  }
}

/** The Cloud receiver accepts a browser handoff only from a local origin. */
export function canHandOffToCloud(): boolean {
  return (
    !!trustedCloudHandoffOrigin() && acceptsCloudChecks(window.location.origin)
  )
}
