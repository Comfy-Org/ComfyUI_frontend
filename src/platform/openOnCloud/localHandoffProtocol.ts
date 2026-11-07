import { z } from 'zod'

import { getComfyCloudBaseUrl } from '@/config/comfyApi'

const LOCAL_HANDOFF_PARAM = 'from_local'

const READY = 'comfy-local-handoff:ready'
const WORKFLOW = 'comfy-local-handoff:workflow'

export const zLocalHandoffReady = z.object({
  type: z.literal(READY),
  nonce: z.string()
})

const zLocalHandoffWorkflow = z.object({
  type: z.literal(WORKFLOW),
  nonce: z.string(),
  filename: z.string(),
  workflow: z.unknown()
})

type LocalHandoffWorkflow = z.infer<typeof zLocalHandoffWorkflow>

export function localHandoffWorkflow(
  nonce: string,
  filename: string,
  workflow: unknown
): LocalHandoffWorkflow {
  return { type: WORKFLOW, nonce, filename, workflow }
}

export function cloudEditorUrl(nonce?: string): string {
  const configured = new URL(getComfyCloudBaseUrl())
  const url = new URL('/', configured)
  for (const override of configured.searchParams.getAll('ff'))
    url.searchParams.append('ff', override)
  if (nonce) url.searchParams.set(LOCAL_HANDOFF_PARAM, nonce)
  return url.href
}

export function cloudOrigin(): string {
  return new URL(getComfyCloudBaseUrl()).origin
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

/** The Cloud receiver accepts a browser handoff only from a local origin. */
export function canHandOffToCloud(): boolean {
  return isLocalOrigin(window.location.origin)
}
