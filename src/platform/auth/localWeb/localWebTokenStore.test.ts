import type { OAuthTokens } from '@comfyorg/account-core/oauthPkce'
import { describe, expect, it, vi } from 'vitest'

import {
  LOCAL_WEB_TOKENS_KEY,
  createStorageTokenStore
} from '@/platform/auth/localWeb/localWebTokenStore'

const TOKENS: OAuthTokens = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  expiresAt: 1_700_000_000_000,
  scope: 'comfy-cloud:user:read'
}

function memoryStorage() {
  const items = new Map<string, string>()
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key)
  }
}

function storageEvent(key: string | null): Event {
  return Object.assign(new Event('storage'), { key })
}

describe('createStorageTokenStore', () => {
  it('reads back what an earlier page load wrote', () => {
    const storage = memoryStorage()
    createStorageTokenStore(storage, new EventTarget()).write(TOKENS)

    expect(createStorageTokenStore(storage, new EventTarget()).read()).toEqual(
      TOKENS
    )
  })

  it('returns the same object until the stored value changes', () => {
    const store = createStorageTokenStore(memoryStorage(), new EventTarget())
    store.write(TOKENS)

    expect(store.read()).toBe(store.read())
  })

  it.for([
    { stored: 'not json' },
    { stored: JSON.stringify({ accessToken: 'access-1' }) },
    { stored: JSON.stringify({ ...TOKENS, expiresAt: 'soon' }) }
  ])('treats a malformed stored value $stored as signed out', ({ stored }) => {
    const storage = memoryStorage()
    storage.setItem(LOCAL_WEB_TOKENS_KEY, stored)

    expect(
      createStorageTokenStore(storage, new EventTarget()).read()
    ).toBeUndefined()
  })

  it('forgets the tokens on clear', () => {
    const storage = memoryStorage()
    const store = createStorageTokenStore(storage, new EventTarget())
    store.write(TOKENS)

    store.clear()

    expect(store.read()).toBeUndefined()
    expect(storage.items.has(LOCAL_WEB_TOKENS_KEY)).toBe(false)
  })

  it('reports a change another tab made to its key, and only its key', () => {
    const events = new EventTarget()
    const store = createStorageTokenStore(memoryStorage(), events)
    const listener = vi.fn()
    store.subscribe(listener)

    events.dispatchEvent(storageEvent('Comfy.Other'))
    events.dispatchEvent(storageEvent(LOCAL_WEB_TOKENS_KEY))
    events.dispatchEvent(storageEvent(null))

    expect(listener).toHaveBeenCalledTimes(2)
  })
})
