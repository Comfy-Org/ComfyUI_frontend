import { z } from 'zod'

import { cloudEditorUrl } from '@/platform/openOnCloud/localHandoffProtocol'

export const DESKTOP_RELAY_PARAM = 'desktop_workflow'
export const DESKTOP_HANDOFF_HASH = '#desktop_workflow='
export const DESKTOP_HANDOFF_LIFETIME_MS = 10 * 60_000
const MAX_HANDOFF_BYTES = 8 * 1024 * 1024
const MAX_ENCODED_LENGTH = 1024 * 1024

const zDesktopWorkflowHandoff = z.object({
  filename: z.string().min(1).max(256),
  workflow: z.unknown(),
  expiresAt: z.number()
})

export type DesktopWorkflowHandoff = z.infer<typeof zDesktopWorkflowHandoff>

export async function desktopWorkflowUrl(
  nonce: string,
  handoff: DesktopWorkflowHandoff
): Promise<string | undefined> {
  const body = new Blob([JSON.stringify(handoff)])
  if (body.size > MAX_HANDOFF_BYTES) return undefined
  const compressed = body.stream().pipeThrough(new CompressionStream('gzip'))
  const bytes = new Uint8Array(await new Response(compressed).arrayBuffer())
  const encoded = btoa(
    Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
  )
  if (encoded.length > MAX_ENCODED_LENGTH) return undefined
  const url = new URL(cloudEditorUrl(nonce))
  url.hash = `${DESKTOP_HANDOFF_HASH}${encoded}`
  return url.href
}
