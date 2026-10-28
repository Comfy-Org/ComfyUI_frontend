import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'

type FolderPaths = Record<string, string[]>

let pending: Promise<FolderPaths | undefined> | undefined
let listening = false

function invalidate(): void {
  pending = undefined
}

/**
 * Shares one `/folder_paths` request per backend connection. Resolves
 * `undefined` when the lookup fails; the failure is reported and not cached.
 */
export function loadFolderPathsOnce(): Promise<FolderPaths | undefined> {
  if (!listening) {
    listening = true
    api.addEventListener('reconnected', invalidate)
  }
  if (pending) return pending

  const request = api.getFolderPaths().catch((error: unknown) => {
    if (pending === request) pending = undefined
    reportError(error, {
      errorType: 'failure_loading_folder_paths',
      surface: 'platform'
    })
    return undefined
  })
  pending = request
  return request
}

/** Test seam. Production invalidation happens on reconnect. */
export function resetFolderPathCache(): void {
  invalidate()
}
