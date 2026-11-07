import { z } from 'zod'

import {
  cloudEditorUrl,
  LOCAL_HANDOFF_PARAM
} from '@/platform/openOnCloud/localHandoffProtocol'

export const DESKTOP_RELAY_PARAM = 'desktop_workflow'
export const DESKTOP_HANDOFF_HASH = '#desktop_workflow='
export const DESKTOP_HANDOFF_LIFETIME_MS = 10 * 60_000
const MAX_HANDOFF_BYTES = 2 * 1024 * 1024
const MAX_ENCODED_LENGTH = 1024 * 1024
const STORAGE_PREFIX = 'Comfy.OpenOnCloud.Desktop.'

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

async function readBoundedHandoff(
  stream: ReadableStream<Uint8Array<ArrayBuffer>>
) {
  const reader = stream.getReader()
  const chunks: Uint8Array<ArrayBuffer>[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return await new Blob(chunks).text()
      size += value.byteLength
      if (size > MAX_HANDOFF_BYTES) {
        await reader.cancel()
        return undefined
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
}

function readStoredHandoff(
  value: string | null
): DesktopWorkflowHandoff | undefined {
  if (!value) return undefined
  try {
    const parsed = zDesktopWorkflowHandoff.safeParse(JSON.parse(value))
    return parsed.success && parsed.data.expiresAt > Date.now()
      ? parsed.data
      : undefined
  } catch {
    return undefined
  }
}

export async function captureDesktopWorkflowHandoff(
  url = new URL(window.location.href)
): Promise<boolean> {
  if (!url.hash.startsWith(DESKTOP_HANDOFF_HASH)) return false
  const encoded = url.hash.slice(DESKTOP_HANDOFF_HASH.length)
  url.hash = ''
  window.history.replaceState(null, '', url.href)
  const nonce = url.searchParams.get(LOCAL_HANDOFF_PARAM)
  if (
    !nonce ||
    !z.uuid().safeParse(nonce).success ||
    encoded.length > MAX_ENCODED_LENGTH
  )
    return false
  try {
    const bytes = Uint8Array.from(atob(encoded), (character) =>
      character.charCodeAt(0)
    )
    const stream = new Blob([bytes])
      .stream()
      .pipeThrough(new DecompressionStream('gzip'))
    const value = await readBoundedHandoff(stream)
    const handoff = readStoredHandoff(value ?? null)
    if (!handoff) return false
    sessionStorage.setItem(`${STORAGE_PREFIX}${nonce}`, JSON.stringify(handoff))
    return true
  } catch {
    return false
  }
}

export function takeDesktopWorkflowHandoff(
  nonce: string
): DesktopWorkflowHandoff | undefined {
  try {
    const key = `${STORAGE_PREFIX}${nonce}`
    const value = sessionStorage.getItem(key)
    sessionStorage.removeItem(key)
    return readStoredHandoff(value)
  } catch {
    return undefined
  }
}
