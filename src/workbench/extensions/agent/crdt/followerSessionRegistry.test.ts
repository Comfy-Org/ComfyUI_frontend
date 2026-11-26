import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'

import { setAssertReporter } from '@comfyorg/shared-frontend-utils/assert'

import type { FollowerSessionLease } from './followerSessionRegistry'
import { createFollowerSessionRegistry } from './followerSessionRegistry'

const DOC_A = 'cd5e2f61-7a0b-4c38-9d12-5b6e8f0a2c41'
const DOC_B = 'f1a9c704-62d5-4e8b-83a7-0c4e9b16d2f8'

function granted<T>(
  lease: FollowerSessionLease<T> | null
): FollowerSessionLease<T> {
  assert.exists(
    lease,
    'the registry refused a claim this case expects it to grant'
  )
  return lease
}

function sessions() {
  const disposed: number[] = []
  let minted = 0
  const registry = createFollowerSessionRegistry(() => {
    const id = ++minted
    return { session: { id }, dispose: () => disposed.push(id) }
  })
  return { registry, disposed, minted: () => minted }
}

describe('follower session registry', () => {
  it('mints one session for the first holder and hands the same one to the next', () => {
    const { registry, minted } = sessions()

    const first = granted(registry.acquire(DOC_A))
    const second = granted(registry.acquire(DOC_A))

    expect(minted()).toBe(1)
    expect(second.session).toBe(first.session)
    expect(registry.holderCount(DOC_A)).toBe(2)
    expect(registry.heldDocumentIds()).toEqual([DOC_A])
  })

  it('disposes on the last release, never on the first', () => {
    const { registry, disposed } = sessions()
    const first = granted(registry.acquire(DOC_A))
    const second = granted(registry.acquire(DOC_A))

    first.release()
    expect(disposed).toEqual([])
    expect(registry.session()).toBe(second.session)

    second.release()
    expect(disposed).toEqual([1])
    expect(registry.session()).toBeNull()
  })

  it('keeps a second holder alive when the first holder releases twice', () => {
    const { registry, disposed } = sessions()
    const holderA = granted(registry.acquire(DOC_A))
    const holderB = granted(registry.acquire(DOC_A))
    const session = holderB.session

    holderA.release()
    expect(() => holderA.release()).toThrowError(/released the same follower/)

    expect(disposed).toEqual([])
    expect(registry.session()).toBe(session)
    expect(registry.holderCount(DOC_A)).toBe(1)

    holderB.release()
    expect(disposed).toEqual([1])
    expect(registry.session()).toBeNull()
  })

  it('counts holders per document and survives a rebind that acquires before releasing', () => {
    const { registry, disposed, minted } = sessions()
    const onA = granted(registry.acquire(DOC_A))

    const onB = granted(registry.acquire(DOC_B))
    onA.release()

    expect(minted()).toBe(1)
    expect(disposed).toEqual([])
    expect(registry.heldDocumentIds()).toEqual([DOC_B])
    expect(registry.holderCount(DOC_A)).toBe(0)
    expect(registry.holderCount(DOC_B)).toBe(1)

    onB.release()
    expect(disposed).toEqual([1])
  })

  it('mints a new session after the previous one was disposed', () => {
    const { registry, minted } = sessions()
    granted(registry.acquire(DOC_A)).release()

    const next = granted(registry.acquire(DOC_A))

    expect(minted()).toBe(2)
    expect(next.session).toEqual({ id: 2 })
  })

  it('does not count a holder acquired before any document is named', () => {
    const { registry } = sessions()
    const unbound = granted(registry.acquire(null))

    expect(registry.heldDocumentIds()).toEqual([])
    expect(registry.holderCount(null)).toBe(1)
    expect(registry.session()).toBe(unbound.session)
  })

  it('throws on a claim made from inside the minting call, in DEV', () => {
    let minted = 0
    let reentered: unknown = null
    const registry = createFollowerSessionRegistry<{ id: number }>(() => {
      const id = ++minted
      try {
        registry.acquire(DOC_A)
      } catch (error) {
        reentered = error
      }
      return { session: { id }, dispose: () => {} }
    })

    const lease = granted(registry.acquire(DOC_A))

    expect(reentered).toBeInstanceOf(Error)
    expect(reentered).toMatchObject({
      message: expect.stringMatching(/still minting one/)
    })
    expect(minted).toBe(1)
    expect(registry.session()).toBe(lease.session)
    expect(registry.holderCount(DOC_A)).toBe(1)
  })

  it('refuses the re-entrant claim as a value in production, where the assertion only reports', () => {
    vi.stubEnv('DEV', false)
    const reported: string[] = []
    setAssertReporter((message) => reported.push(message))
    onTestFinished(() => setAssertReporter(null))

    let minted = 0
    const disposed: number[] = []
    let reentrantClaim: unknown = 'never attempted'
    const registry = createFollowerSessionRegistry<{ id: number }>(() => {
      const id = ++minted
      reentrantClaim = registry.acquire(DOC_A)
      return { session: { id }, dispose: () => disposed.push(id) }
    })

    const lease = registry.acquire(DOC_A)

    expect(reentrantClaim).toBeNull()
    expect(reported).toHaveLength(1)
    expect(reported[0]).toContain('still minting one')
    expect(minted).toBe(1)
    expect(lease).not.toBeNull()
    expect(registry.session()).toBe(lease?.session)
    expect(registry.holderCount(DOC_A)).toBe(1)

    lease?.release()
    expect(disposed).toEqual([1])
    expect(registry.session()).toBeNull()
  })

  it('destroy disposes the session, and a stale release does not touch the session that replaced it', () => {
    const { registry, disposed, minted } = sessions()
    const stale = granted(registry.acquire(DOC_A))

    registry.destroy()
    expect(disposed).toEqual([1])
    expect(registry.session()).toBeNull()

    const next = granted(registry.acquire(DOC_A))
    stale.release()

    expect(minted()).toBe(2)
    expect(registry.session()).toBe(next.session)
    expect(registry.holderCount(DOC_A)).toBe(1)
    expect(disposed).toEqual([1])
  })
})
