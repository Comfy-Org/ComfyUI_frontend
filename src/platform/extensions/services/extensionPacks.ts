import { FETCH_RESPONSE_HEADERS_TIMEOUT_MS } from '@comfyorg/api-client/apiTimeouts'
import { z } from 'zod'

import { api } from '@/scripts/api'

const zServedPacks = z.array(
  z.object({
    segment: z.string().min(1),
    id: z.string().min(1),
    version: z.string().nullable()
  })
)

type ServedPacks = z.infer<typeof zServedPacks>

function unverified(reason: unknown): undefined {
  console.warn(
    '[extensions] The backend lists no verified V4 packs; they load unverified.',
    reason
  )
  return undefined
}

/** The V4 packs the backend verified; `undefined` when it gives none, as an older backend does, an unusable reply, or none within the request bound. */
export async function fetchExtensionPacks(): Promise<ServedPacks | undefined> {
  const deadline = new AbortController()
  const timer = setTimeout(
    () =>
      deadline.abort(
        new DOMException('The pack lookup timed out', 'TimeoutError')
      ),
    FETCH_RESPONSE_HEADERS_TIMEOUT_MS
  )
  try {
    const response = await api.fetchApi('/extension_packs', {
      cache: 'no-store',
      skipStatusRetry: true,
      signal: deadline.signal
    })
    if (!response.ok) return unverified(`status ${response.status}`)
    const parsed = zServedPacks.safeParse(await response.json())
    return parsed.success ? parsed.data : unverified(parsed.error.message)
  } catch (error) {
    return unverified(error)
  } finally {
    clearTimeout(timer)
  }
}
