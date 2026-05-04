import { describe, expect, it, vi } from 'vitest'

import { verifyCandidatesByAssetHash } from './assetHashVerification'

interface Candidate {
  id: string
  hash: string | null
}

function candidate(id: string, hash: string | null): Candidate {
  return { id, hash }
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
    const candidates = Array.from({ length: 6 }, (_, index) =>
      candidate(String(index), `blake3:${index}`)
    )

    await verifyCandidatesByAssetHash({
      candidates,
      getAssetHash: (candidate) => candidate.hash,
      maxConcurrent: 2,
      checkAssetHash: async () => {
        activeChecks++
        maxActiveChecks = Math.max(maxActiveChecks, activeChecks)
        await new Promise((resolve) => setTimeout(resolve, 1))
        activeChecks--
        return 'missing'
      }
    })

    expect(maxActiveChecks).toBeLessThanOrEqual(2)
  })
})
