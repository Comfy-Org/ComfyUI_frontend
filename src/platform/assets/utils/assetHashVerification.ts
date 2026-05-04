import type { AssetHashStatus } from '@/platform/assets/services/assetService'
import { isAbortError } from '@/utils/typeGuardUtil'

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
  const workerCount = Math.min(
    entries.length,
    Math.max(1, Math.floor(maxConcurrent))
  )

  async function verifyNextHash(): Promise<void> {
    while (!result.aborted && nextIndex < entries.length) {
      const entry = entries[nextIndex++]
      if (!entry) return

      const [assetHash, hashCandidates] = entry
      if (signal?.aborted) {
        result.aborted = true
        return
      }

      let status: AssetHashStatus
      try {
        status = await checkAssetHash(assetHash, signal)
      } catch (error) {
        if (signal?.aborted || isAbortError(error)) {
          result.aborted = true
          return
        }

        onError?.(error)
        result.fallback.push(...hashCandidates)
        continue
      }

      if (signal?.aborted) {
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

  await Promise.all(
    Array.from({ length: workerCount }, async () => await verifyNextHash())
  )

  return result
}
