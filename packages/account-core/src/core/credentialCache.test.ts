import { describe, expect, it, vi } from 'vitest'

import {
  credential as makeCredential,
  memoryStorage
} from './__fixtures__/sessionFakes.js'
import {
  createCredentialCache,
  decodeAdopted,
  decodeCached,
  encodeCached,
  selectFreshCredential
} from './credentialCache.js'
import type { AccountCredential } from './sessionContracts.js'

const credential = makeCredential('cached-jwt')

describe('decodeCached', () => {
  it.for<{ name: string; raw: string }>([
    { name: 'malformed JSON', raw: '{not json' },
    { name: 'a record missing the contract fields', raw: '{"uid":"uid-1"}' },
    {
      name: 'a record for another user',
      raw: encodeCached({ ...credential, uid: 'someone-else' }, undefined)
    },
    {
      name: 'an empty token',
      raw: encodeCached({ ...credential, token: '' }, undefined)
    },
    {
      name: 'a non-finite expiry',
      raw: encodeCached(credential, undefined).replace(
        '"expiresAt":1000000',
        '"expiresAt":1e999'
      )
    }
  ])('rejects $name', ({ raw }) => {
    expect(decodeCached(raw, 'uid-1')).toBeUndefined()
  })

  it.for<{ name: string; target: string | undefined }>([
    { name: 'a workspace target', target: 'ws-9' },
    { name: 'the absent personal target', target: undefined }
  ])('round-trips a credential with $name', ({ target }) => {
    expect(decodeCached(encodeCached(credential, target), 'uid-1')).toEqual({
      credential,
      target
    })
  })
})

describe('decodeAdopted', () => {
  it('returns the credential without the storage-only target', () => {
    expect(decodeAdopted({ ...credential, target: 'ws-9' })).toEqual(credential)
  })

  it.for<{ name: string; message: unknown }>([
    { name: 'a non-object', message: 'not even an object' },
    { name: 'a record missing the contract fields', message: { token: 'x' } },
    {
      name: 'a non-finite expiry',
      message: { ...credential, expiresAt: Number.POSITIVE_INFINITY }
    },
    { name: 'an empty token', message: { ...credential, token: '' } }
  ])('rejects $name', ({ message }) => {
    expect(decodeAdopted(message)).toBeUndefined()
  })
})

describe('createCredentialCache', () => {
  it('writes and reads back a credential for its user only', () => {
    const cache = createCredentialCache(memoryStorage())

    cache.write(credential, 'ws-9')

    expect(cache.read('uid-1')).toEqual({ credential, target: 'ws-9' })
    expect(cache.read('someone-else')).toBeUndefined()
  })

  it('reads a miss after clear', () => {
    const cache = createCredentialCache(memoryStorage())
    cache.write(credential, undefined)

    cache.clear()

    expect(cache.read('uid-1')).toBeUndefined()
  })

  it('degrades a throwing medium to a miss and swallows failed writes and clears', () => {
    const cache = createCredentialCache({
      read: () => {
        throw new Error('blocked')
      },
      write: () => {
        throw new Error('quota')
      },
      clear: () => {
        throw new Error('blocked')
      }
    })

    expect(cache.read('uid-1')).toBeUndefined()
    expect(() => cache.write(credential, undefined)).not.toThrow()
    expect(() => cache.clear()).not.toThrow()
  })
})

describe('selectFreshCredential', () => {
  const fresh = makeCredential('fresh')
  const stale = makeCredential('stale', { expiresAt: 500_000 })
  const now = 400_000
  const margin = 300_000

  it.for<{
    name: string
    memory: AccountCredential | undefined
    memoryTarget: string | undefined
    stored: { credential: AccountCredential; target: string | undefined }
    target: string | undefined
    expected: string | undefined
  }>([
    {
      name: 'a fresh in-memory credential for the target wins over storage',
      memory: fresh,
      memoryTarget: 'ws-1',
      stored: { credential: makeCredential('stored'), target: 'ws-1' },
      target: 'ws-1',
      expected: 'fresh'
    },
    {
      name: 'a stale in-memory credential falls through to fresh storage',
      memory: stale,
      memoryTarget: 'ws-1',
      stored: { credential: makeCredential('stored'), target: 'ws-1' },
      target: 'ws-1',
      expected: 'stored'
    },
    {
      name: 'an in-memory credential for another target is skipped',
      memory: fresh,
      memoryTarget: 'ws-9',
      stored: { credential: makeCredential('stored'), target: 'ws-1' },
      target: 'ws-1',
      expected: 'stored'
    },
    {
      name: 'a stored credential for another target is skipped',
      memory: undefined,
      memoryTarget: undefined,
      stored: { credential: makeCredential('stored'), target: 'ws-9' },
      target: undefined,
      expected: undefined
    },
    {
      name: 'an in-memory credential for another user is skipped',
      memory: makeCredential('other', { uid: 'uid-2' }),
      memoryTarget: 'ws-1',
      stored: { credential: stale, target: 'ws-1' },
      target: 'ws-1',
      expected: undefined
    },
    {
      name: 'nothing fresh anywhere yields no candidate',
      memory: stale,
      memoryTarget: 'ws-1',
      stored: { credential: stale, target: 'ws-1' },
      target: 'ws-1',
      expected: undefined
    }
  ])('$name', ({ memory, memoryTarget, stored, target, expected }) => {
    const selected = selectFreshCredential(
      [() => ({ credential: memory, target: memoryTarget }), () => stored],
      'uid-1',
      target,
      now,
      margin
    )

    expect(selected?.token).toBe(expected)
  })

  it('treats a storage miss as no candidate', () => {
    expect(
      selectFreshCredential(
        [() => ({ credential: undefined, target: undefined }), () => undefined],
        'uid-1',
        undefined,
        now,
        margin
      )
    ).toBeUndefined()
  })

  it('does not consult a later candidate once an earlier one is fresh', () => {
    const stored = vi.fn(() => ({
      credential: makeCredential('stored'),
      target: 'ws-1'
    }))

    selectFreshCredential(
      [() => ({ credential: makeCredential('fresh'), target: 'ws-1' }), stored],
      'uid-1',
      'ws-1',
      400_000,
      300_000
    )

    expect(stored).not.toHaveBeenCalled()
  })
})
