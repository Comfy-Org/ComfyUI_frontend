import { z } from 'zod'

import { safeSessionStorage } from '@/base/storage/safeStorage'

const STORAGE_KEY = 'Comfy.WebSession.InteractiveSignIn'
const MAX_AGE_MS = 2 * 60_000

const zMarker = z.object({ uid: z.string(), at: z.number() })

export function markInteractiveSignIn(uid: string): void {
  safeSessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ uid, at: Date.now() })
  )
}

export function clearInteractiveSignIn(): void {
  safeSessionStorage.removeItem(STORAGE_KEY)
}

/** True once, and only for a fresh marker written for this Firebase user. */
export function takeInteractiveSignIn(uid: string): boolean {
  let json: unknown
  try {
    const raw = safeSessionStorage.getItem(STORAGE_KEY)
    clearInteractiveSignIn()
    if (raw === null) return false
    json = JSON.parse(raw)
  } catch {
    return false
  }
  const marker = zMarker.safeParse(json)
  return (
    marker.success &&
    marker.data.uid === uid &&
    Date.now() - marker.data.at >= 0 &&
    Date.now() - marker.data.at <= MAX_AGE_MS
  )
}
