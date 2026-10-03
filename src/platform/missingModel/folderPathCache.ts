import { api } from '@/scripts/api'

/**
 * `/folder_paths` answers with the directories ComfyUI resolved at startup, so
 * the value cannot change while a backend stays up. One in-flight request is
 * shared, and a reconnect is the only thing that invalidates it - a restarted
 * backend may have different paths.
 */
let pending: Promise<Record<string, string[]>> | undefined
let listening = false

function invalidate(): void {
  pending = undefined
}

export function loadFolderPathsOnce(): Promise<Record<string, string[]>> {
  if (!listening) {
    listening = true
    api.addEventListener('reconnected', invalidate)
  }
  pending ??= api.getFolderPaths().catch((error: unknown) => {
    // A failure must not be cached: the next caller should ask again.
    pending = undefined
    throw error
  })
  return pending
}

/** Test seam. Production invalidation happens on reconnect. */
export function resetFolderPathCache(): void {
  invalidate()
}
