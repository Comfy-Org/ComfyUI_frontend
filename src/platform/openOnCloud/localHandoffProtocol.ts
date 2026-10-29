import { z } from 'zod'

import { getComfyCloudBaseUrl } from '@/config/comfyApi'

/** The query parameter that carries a handoff's nonce to the Comfy Cloud tab. */
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

/** What the Comfy Cloud tab sends its opener to ask for the workflow. */
export function localHandoffReady(nonce: string): LocalHandoffReady {
  return { type: READY, nonce }
}

/** What local ComfyUI answers the ready message with. */
export function localHandoffWorkflow(
  nonce: string,
  filename: string,
  workflow: unknown
): LocalHandoffWorkflow {
  return { type: WORKFLOW, nonce, filename, workflow }
}

/** Comfy Cloud's editor; with a nonce, the tab asks its opener for the workflow. */
export function cloudEditorUrl(nonce?: string): string {
  const url = new URL('/', getComfyCloudBaseUrl())
  if (nonce) url.searchParams.set(LOCAL_HANDOFF_PARAM, nonce)
  return url.href
}

export function cloudOrigin(): string {
  return new URL(getComfyCloudBaseUrl()).origin
}

const LOCAL_HOSTNAME =
  /^(localhost|\[::1\]|127(\.\d{1,3}){3}|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2}|[\w-]+\.local)$/

function parseOrigin(origin: string): URL | null {
  try {
    return new URL(origin)
  } catch {
    return null
  }
}

/** Whether a page origin is on this computer or its private network. */
export function isLocalOrigin(origin: string): boolean {
  const url = parseOrigin(origin)
  return (
    url !== null &&
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    LOCAL_HOSTNAME.test(url.hostname)
  )
}
