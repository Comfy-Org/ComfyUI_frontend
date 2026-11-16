import { api } from '@/scripts/api'

/**
 * `/folder_paths` answers with the directories ComfyUI resolved at startup, so
 * a given backend process keeps answering the same way. One in-flight request
 * is shared, and a reconnect invalidates it, since the backend on the other
 * side may be a different process with different paths.
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
  if (pending) return pending

  const request: Promise<Record<string, string[]>> = api
    .getFolderPaths()
    .catch((error: unknown) => {
      // A failure must not be cached, but only this request may clear it: a
      // reconnect, or a caller that asked after one, may already have put a
      // newer request in its place.
      if (pending === request) pending = undefined
      throw error
    })
  pending = request
  return request
}

/** Test seam. Production invalidation happens on reconnect. */
export function resetFolderPathCache(): void {
  invalidate()
}
