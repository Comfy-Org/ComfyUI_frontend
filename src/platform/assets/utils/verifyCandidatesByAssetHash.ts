import type {
  AssetHashStatus,
  AssetHashVerifier
} from '@/platform/assets/services/assetService'
import { isAbortError } from '@/utils/typeGuardUtil'

/**
 * Returns true when the status fully resolves the group; false leaves the group
 * for the caller's fallback path.
 */
type ApplyAssetHashStatus<T> = (status: AssetHashStatus, group: T[]) => boolean

/**
 * Verifies grouped candidates against the asset hash endpoint in parallel.
 *
 * For each `[hash, group]` entry, calls `checkAssetHash(hash)` and hands the
 * resulting status to `applyStatus`. Groups whose status is unresolved or
 * whose request fails (non-abort) are returned so the caller can run a
 * fallback path. Aborts and abort-propagated rejections are silent.
 */
export async function verifyCandidatesByAssetHash<T>(
  candidatesByHash: Record<string, T[]>,
  signal: AbortSignal | undefined,
  checkAssetHash: AssetHashVerifier,
  applyStatus: ApplyAssetHashStatus<T>,
  logTag: string
): Promise<T[][]> {
  const unresolved: T[][] = []

  await Promise.all(
    Object.entries(candidatesByHash).map(async ([assetHash, group]) => {
      if (signal?.aborted) return

      try {
        const status = await checkAssetHash(assetHash, signal)
        if (signal?.aborted) return
        if (!applyStatus(status, group)) unresolved.push(group)
      } catch (err) {
        if (signal?.aborted || isAbortError(err)) return
        console.warn(`${logTag} Failed to verify asset hash:`, err)
        unresolved.push(group)
      }
    })
  )

  return unresolved
}
