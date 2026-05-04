import type { AssetHashStatus } from '@/platform/assets/services/assetService'
import { isAbortError } from '@/utils/typeGuardUtil'

/**
 * Low-level hash checker. Cancellation should reject with the same
 * DOMException AbortError shape as `fetch`.
 */
export type AssetHashVerifier = (
  assetHash: string,
  signal?: AbortSignal
) => Promise<AssetHashStatus>

interface AssetHashVerificationResult<T> {
  existing: T[]
  missing: T[]
  fallback: T[]
  aborted: boolean
}

interface VerifyCandidatesByAssetHashOptions<T> {
  candidates: readonly T[]
  getAssetHash: (candidate: T) => string | null
  checkAssetHash: AssetHashVerifier
  signal?: AbortSignal
  maxConcurrent?: number
  onError?: (error: unknown) => void
}

const DEFAULT_MAX_CONCURRENT_HASH_CHECKS = 12

/**
 * Deduplicates asset hash checks and partitions candidates for scanner policy.
 * `fallback` candidates should continue through the caller's legacy lookup path.
 */
export async function verifyCandidatesByAssetHash<T>({
  candidates,
  getAssetHash,
  checkAssetHash,
  signal,
  maxConcurrent = DEFAULT_MAX_CONCURRENT_HASH_CHECKS,
  onError
}: VerifyCandidatesByAssetHashOptions<T>): Promise<
  AssetHashVerificationResult<T>
> {
  const result: AssetHashVerificationResult<T> = {
    existing: [],
    missing: [],
    fallback: [],
    aborted: false
  }

  if (signal?.aborted) return { ...result, aborted: true }

  const candidatesByHash = new Map<string, T[]>()
  for (const candidate of candidates) {
    const assetHash = getAssetHash(candidate)
    if (!assetHash) {
      result.fallback.push(candidate)
      continue
    }

    const hashCandidates = candidatesByHash.get(assetHash)
    if (hashCandidates) hashCandidates.push(candidate)
    else candidatesByHash.set(assetHash, [candidate])
  }

  const entries = [...candidatesByHash.entries()]
  let nextIndex = 0
  const requestedWorkerCount = Math.max(1, Math.floor(maxConcurrent))
  const workerCount = Math.min(entries.length, requestedWorkerCount)

  function hasAborted(): boolean {
    return result.aborted || signal?.aborted === true
  }

  async function verifyNextHash(): Promise<void> {
    while (!hasAborted() && nextIndex < entries.length) {
      const entry = entries[nextIndex++]
      if (!entry) return

      const [assetHash, hashCandidates] = entry
      if (hasAborted()) {
        result.aborted = true
        return
      }

      let status: AssetHashStatus
      try {
        status = await checkAssetHash(assetHash, signal)
      } catch (error) {
        if (hasAborted() || isAbortError(error)) {
          result.aborted = true
          return
        }

        onError?.(error)
        result.fallback.push(...hashCandidates)
        continue
      }

      if (hasAborted()) {
        result.aborted = true
        return
      }

      if (status === 'exists') {
        result.existing.push(...hashCandidates)
      } else if (status === 'missing') {
        result.missing.push(...hashCandidates)
      } else {
        result.fallback.push(...hashCandidates)
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, verifyNextHash))

  return result
}
