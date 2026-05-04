import { describe, expect, it, vi } from 'vitest'

import type { AssetHashStatus } from '@/platform/assets/services/assetService'

import { verifyCandidatesByAssetHash } from './assetHashVerification'

interface Candidate {
  id: string
  hash: string | null
}

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

function candidate(id: string, hash: string | null): Candidate {
  return { id, hash }
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, resolve, reject }
}

describe(verifyCandidatesByAssetHash, () => {
  it('deduplicates hash checks and groups existing and missing candidates', async () => {
    const existingHash = 'blake3:existing'
    const missingHash = 'blake3:missing'
    const candidates = [
      candidate('a', existingHash),
      candidate('b', existingHash),
      candidate('c', missingHash)
    ]
    const checkAssetHash = vi.fn(async (hash: string) =>
      hash === existingHash ? ('exists' as const) : ('missing' as const)
    )

    const result = await verifyCandidatesByAssetHash({
      candidates,
      getAssetHash: (candidate) => candidate.hash,
      checkAssetHash
    })

    expect(result.aborted).toBe(false)
    expect(result.existing.map((candidate) => candidate.id)).toEqual(['a', 'b'])
    expect(result.missing.map((candidate) => candidate.id)).toEqual(['c'])
    expect(result.fallback).toEqual([])
    expect(checkAssetHash).toHaveBeenCalledTimes(2)
  })

  it('routes candidates without hashes and invalid hashes to fallback', async () => {
    const invalidHash = 'blake3:invalid'
    const candidates = [candidate('a', null), candidate('b', invalidHash)]
    const checkAssetHash = vi.fn(async () => 'invalid' as const)

    const result = await verifyCandidatesByAssetHash({
      candidates,
      getAssetHash: (candidate) => candidate.hash,
      checkAssetHash
    })

    expect(result.existing).toEqual([])
    expect(result.missing).toEqual([])
    expect(result.fallback.map((candidate) => candidate.id)).toEqual(['a', 'b'])
    expect(checkAssetHash).toHaveBeenCalledOnce()
  })

  it('routes non-abort verification failures to fallback', async () => {
    const candidates = [candidate('a', 'blake3:network-failure')]
    const error = new Error('network failed')
    const onError = vi.fn()

    const result = await verifyCandidatesByAssetHash({
      candidates,
      getAssetHash: (candidate) => candidate.hash,
      checkAssetHash: async () => {
        throw error
      },
      onError
    })

    expect(result.fallback).toEqual(candidates)
    expect(result.aborted).toBe(false)
    expect(onError).toHaveBeenCalledWith(error)
  })

  it('returns aborted without resolving candidates when the signal is aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const candidates = [candidate('a', 'blake3:aborted')]
    const checkAssetHash = vi.fn(async () => 'exists' as const)

    const result = await verifyCandidatesByAssetHash({
      candidates,
      getAssetHash: (candidate) => candidate.hash,
      checkAssetHash,
      signal: controller.signal
    })

    expect(result).toEqual({
      existing: [],
      missing: [],
      fallback: [],
      aborted: true
    })
    expect(checkAssetHash).not.toHaveBeenCalled()
  })

  it('silences abort errors from hash verification', async () => {
    const candidates = [candidate('a', 'blake3:aborted')]
    const onError = vi.fn()

    const result = await verifyCandidatesByAssetHash({
      candidates,
      getAssetHash: (candidate) => candidate.hash,
      checkAssetHash: async () => {
        throw new DOMException('aborted', 'AbortError')
      },
      onError
    })

    expect(result.aborted).toBe(true)
    expect(result.existing).toEqual([])
    expect(result.missing).toEqual([])
    expect(result.fallback).toEqual([])
    expect(onError).not.toHaveBeenCalled()
  })

  it('caps concurrent hash checks', async () => {
    let activeChecks = 0
    let maxActiveChecks = 0
    let completedChecks = 0
    const inFlight: Array<Deferred<AssetHashStatus>> = []
    const candidates = Array.from({ length: 6 }, (_, index) =>
      candidate(String(index), `blake3:${index}`)
    )

    const verificationPromise = verifyCandidatesByAssetHash({
      candidates,
      getAssetHash: (candidate) => candidate.hash,
      maxConcurrent: 2,
      checkAssetHash: async () => {
        activeChecks++
        maxActiveChecks = Math.max(maxActiveChecks, activeChecks)
        const deferred = createDeferred<AssetHashStatus>()
        inFlight.push(deferred)

        try {
          return await deferred.promise
        } finally {
          activeChecks--
          completedChecks++
        }
      }
    })

    while (completedChecks < candidates.length) {
      const currentChecks = inFlight.splice(0)
      expect(currentChecks.length).toBeLessThanOrEqual(2)
      for (const check of currentChecks) {
        check.resolve('missing')
      }
      await Promise.resolve()
    }

    await verificationPromise
    expect(maxActiveChecks).toBeLessThanOrEqual(2)
  })

  it('does not report fallback failures after another worker aborts', async () => {
    const abortHash = 'blake3:abort'
    const errorHash = 'blake3:error'
    const requests = new Map<string, Deferred<AssetHashStatus>>()
    const onError = vi.fn()

    const verificationPromise = verifyCandidatesByAssetHash({
      candidates: [candidate('a', abortHash), candidate('b', errorHash)],
      getAssetHash: (candidate) => candidate.hash,
      maxConcurrent: 2,
      checkAssetHash: (hash) => {
        const deferred = createDeferred<AssetHashStatus>()
        requests.set(hash, deferred)
        return deferred.promise
      },
      onError
    })

    expect(requests.size).toBe(2)
    requests.get(abortHash)?.reject(new DOMException('aborted', 'AbortError'))
    await Promise.resolve()
    requests.get(errorHash)?.reject(new Error('network failed'))

    const result = await verificationPromise

    expect(result).toEqual({
      existing: [],
      missing: [],
      fallback: [],
      aborted: true
    })
    expect(onError).not.toHaveBeenCalled()
  })
})
