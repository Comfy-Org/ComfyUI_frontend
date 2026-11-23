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

/** The V4 packs the backend verified; `undefined` when it gives none, as an older backend does, or an unusable reply. */
export async function fetchExtensionPacks(): Promise<ServedPacks | undefined> {
  try {
    const response = await api.fetchApi('/extension_packs', {
      cache: 'no-store',
      skipStatusRetry: true
    })
    if (!response.ok) return unverified(`status ${response.status}`)
    const parsed = zServedPacks.safeParse(await response.json())
    return parsed.success ? parsed.data : unverified(parsed.error.message)
  } catch (error) {
    return unverified(error)
  }
}
