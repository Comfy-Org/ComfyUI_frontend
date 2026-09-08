/**
 * R1a runtime-toggle gate. The behaviour under test: hosted predeploy bundles
 * are built with `VITE_AGENT_CRDT_FOLLOWER` unset, so the follower must be
 * enableable per session via `?agentCrdtFollower=1` / localStorage — and an
 * explicit URL param must win over everything, in both directions.
 */
import { describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'

import {
  FOLLOWER_QUERY_PARAM,
  FOLLOWER_STORAGE_KEY,
  resolveFollowerEnabled
} from './followerGate'

vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: vi.fn()
}))

class FakeStorage {
  private readonly map = new Map<string, string>()

  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
  removeItem(key: string): void {
    this.map.delete(key)
  }
}

class DeniedStorage {
  getItem(): string | null {
    throw new DOMException('denied', 'SecurityError')
  }
  setItem(): void {
    throw new DOMException('denied', 'SecurityError')
  }
  removeItem(): void {
    throw new DOMException('denied', 'SecurityError')
  }
}

const on = `?${FOLLOWER_QUERY_PARAM}=1`
const off = `?${FOLLOWER_QUERY_PARAM}=0`

describe('resolveFollowerEnabled', () => {
  it('stays disabled with no flag, no param, no persisted opt-in', () => {
    expect(
      resolveFollowerEnabled({
        buildFlag: undefined,
        search: '',
        storage: new FakeStorage()
      })
    ).toBe(false)
  })

  it('build-time flag alone enables (existing dev:cloud:crdt path)', () => {
    expect(
      resolveFollowerEnabled({
        buildFlag: 'true',
        search: '',
        storage: new FakeStorage()
      })
    ).toBe(true)
  })

  it('only the exact string "true" counts as a build flag (the `=1` trap)', () => {
    expect(
      resolveFollowerEnabled({
        buildFlag: '1',
        search: '',
        storage: new FakeStorage()
      })
    ).toBe(false)
  })

  it('?agentCrdtFollower=1 enables an inert (env-off) bundle and persists', () => {
    const storage = new FakeStorage()
    expect(
      resolveFollowerEnabled({ buildFlag: undefined, search: on, storage })
    ).toBe(true)
    expect(storage.getItem(FOLLOWER_STORAGE_KEY)).toBe('true')
    // Next navigation, no param: the persisted opt-in carries the session.
    expect(
      resolveFollowerEnabled({ buildFlag: undefined, search: '', storage })
    ).toBe(true)
  })

  it('accepts =true as well as =1', () => {
    expect(
      resolveFollowerEnabled({
        buildFlag: undefined,
        search: `?${FOLLOWER_QUERY_PARAM}=true`,
        storage: new FakeStorage()
      })
    ).toBe(true)
  })

  it('?agentCrdtFollower=0 disables even a flag-on build and clears the opt-in', () => {
    const storage = new FakeStorage()
    storage.setItem(FOLLOWER_STORAGE_KEY, 'true')
    expect(
      resolveFollowerEnabled({ buildFlag: 'true', search: off, storage })
    ).toBe(false)
    expect(storage.getItem(FOLLOWER_STORAGE_KEY)).toBeNull()
    // Without the param the build flag reasserts itself — =0 cleared only the
    // runtime opt-in, it is not a durable veto of the env.
    expect(
      resolveFollowerEnabled({ buildFlag: 'true', search: '', storage })
    ).toBe(true)
  })

  it('an unrecognized param value falls through to flag/storage', () => {
    expect(
      resolveFollowerEnabled({
        buildFlag: 'true',
        search: `?${FOLLOWER_QUERY_PARAM}=banana`,
        storage: new FakeStorage()
      })
    ).toBe(true)
    expect(
      resolveFollowerEnabled({
        buildFlag: undefined,
        search: `?${FOLLOWER_QUERY_PARAM}=banana`,
        storage: new FakeStorage()
      })
    ).toBe(false)
  })

  it('degrades without throwing when storage access is denied', () => {
    const storage = new DeniedStorage()
    // Param still enables the current page load; persistence is just lost.
    expect(
      resolveFollowerEnabled({ buildFlag: undefined, search: on, storage })
    ).toBe(true)
    expect(
      resolveFollowerEnabled({ buildFlag: undefined, search: off, storage })
    ).toBe(false)
    expect(
      resolveFollowerEnabled({ buildFlag: 'true', search: '', storage })
    ).toBe(true)
    expect(reportError).toHaveBeenCalledTimes(3)
    expect(reportError).toHaveBeenNthCalledWith(1, expect.any(DOMException), {
      errorType: 'agent_crdt_follower_storage_access_failed'
    })
    expect(reportError).toHaveBeenNthCalledWith(2, expect.any(DOMException), {
      errorType: 'agent_crdt_follower_storage_access_failed'
    })
    expect(reportError).toHaveBeenNthCalledWith(3, expect.any(DOMException), {
      errorType: 'agent_crdt_follower_storage_access_failed'
    })
  })

  it('handles a null storage (fully unavailable) the same way', () => {
    expect(
      resolveFollowerEnabled({
        buildFlag: undefined,
        search: on,
        storage: null
      })
    ).toBe(true)
    expect(
      resolveFollowerEnabled({
        buildFlag: undefined,
        search: '',
        storage: null
      })
    ).toBe(false)
  })
})
