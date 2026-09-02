import { describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'

import {
  REPLAY_QUERY_PARAM,
  REPLAY_STORAGE_KEY,
  resolveReplayEnabled
} from './replayGate'

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

describe('resolveReplayEnabled', () => {
  it('is OFF by default (no param, no storage, no build flag)', () => {
    expect(
      resolveReplayEnabled({
        buildFlag: undefined,
        search: '',
        storage: new FakeStorage()
      })
    ).toBe(false)
  })

  it('param=1 enables and persists', () => {
    const storage = new FakeStorage()
    expect(
      resolveReplayEnabled({
        buildFlag: undefined,
        search: `?${REPLAY_QUERY_PARAM}=1`,
        storage
      })
    ).toBe(true)
    expect(storage.getItem(REPLAY_STORAGE_KEY)).toBe('true')
    expect(
      resolveReplayEnabled({ buildFlag: undefined, search: '', storage })
    ).toBe(true)
  })

  it('param=0 disables and clears persisted opt-in, even with build flag on', () => {
    const storage = new FakeStorage()
    storage.setItem(REPLAY_STORAGE_KEY, 'true')
    expect(
      resolveReplayEnabled({
        buildFlag: 'true',
        search: `?${REPLAY_QUERY_PARAM}=0`,
        storage
      })
    ).toBe(false)
    expect(storage.getItem(REPLAY_STORAGE_KEY)).toBeNull()
  })

  it('falls back to the build flag', () => {
    expect(
      resolveReplayEnabled({ buildFlag: 'true', search: '', storage: null })
    ).toBe(true)
  })

  it('degrades gracefully when storage is denied', () => {
    expect(
      resolveReplayEnabled({
        buildFlag: undefined,
        search: `?${REPLAY_QUERY_PARAM}=1`,
        storage: new DeniedStorage()
      })
    ).toBe(true)
    expect(reportError).toHaveBeenCalledWith(expect.any(DOMException), {
      errorType: 'agent_graph_replay_storage_access_failed'
    })
  })
})
