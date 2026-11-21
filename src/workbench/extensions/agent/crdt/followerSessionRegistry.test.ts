import { describe, expect, it } from 'vitest'

import { createFollowerSessionRegistry } from './followerSessionRegistry'

const DOC_A = 'cd5e2f61-7a0b-4c38-9d12-5b6e8f0a2c41'
const DOC_B = 'f1a9c704-62d5-4e8b-83a7-0c4e9b16d2f8'

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

    const first = registry.acquire(DOC_A)
    const second = registry.acquire(DOC_A)

    expect(minted()).toBe(1)
    expect(second.session).toBe(first.session)
    expect(registry.holderCount(DOC_A)).toBe(2)
    expect(registry.heldDocumentIds()).toEqual([DOC_A])
  })

  it('disposes on the last release, never on the first', () => {
    const { registry, disposed } = sessions()
    const first = registry.acquire(DOC_A)
    const second = registry.acquire(DOC_A)

    first.release()
    expect(disposed).toEqual([])
    expect(registry.session()).toBe(second.session)

    second.release()
    expect(disposed).toEqual([1])
    expect(registry.session()).toBeNull()
  })

  // The ADR's distinguishing pin: a below-zero holder-count diagnostic passes
  // this sequence either way, because 2 -> 1 -> 0 never goes negative. Only
  // per-lease idempotency can observe it, so the assertions below are about
  // B's session still being alive, not about the counter.
  it('keeps a second holder alive when the first holder releases twice', () => {
    const { registry, disposed } = sessions()
    const holderA = registry.acquire(DOC_A)
    const holderB = registry.acquire(DOC_A)
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

  it('counts holders per document and survives a rebind that overlaps', () => {
    const { registry, disposed, minted } = sessions()
    const onA = registry.acquire(DOC_A)

    // Acquire-before-release: the holder count never reaches zero, so the
    // seam that carries document A's unsent operations is not disposed.
    const onB = registry.acquire(DOC_B)
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
    registry.acquire(DOC_A).release()

    const next = registry.acquire(DOC_A)

    expect(minted()).toBe(2)
    expect(next.session).toEqual({ id: 2 })
  })

  it('does not count a holder acquired before any document is named', () => {
    const { registry } = sessions()
    const unbound = registry.acquire(null)

    expect(registry.heldDocumentIds()).toEqual([])
    expect(registry.holderCount(null)).toBe(1)
    expect(registry.session()).toBe(unbound.session)
  })

  it('destroy disposes the session and makes a stale release a no-op', () => {
    const { registry, disposed, minted } = sessions()
    const stale = registry.acquire(DOC_A)

    registry.destroy()
    expect(disposed).toEqual([1])
    expect(registry.session()).toBeNull()

    // A handle that outlived its session must not dispose the next one.
    stale.release()
    const next = registry.acquire(DOC_A)
    expect(minted()).toBe(2)
    expect(registry.session()).toBe(next.session)
    expect(disposed).toEqual([1])
  })
})
