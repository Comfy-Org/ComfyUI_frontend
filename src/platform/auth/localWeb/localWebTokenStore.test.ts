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

  it('keeps the tokens of each workspace across page loads until clear', () => {
    const storage = memoryStorage()
    const other = { ...TOKENS, accessToken: 'access-2' }
    const first = createStorageTokenStore(storage, new EventTarget())
    first.writeWorkspace('ws-1', TOKENS)
    first.writeWorkspace('ws-2', other)

    const reloaded = createStorageTokenStore(storage, new EventTarget())
    expect(reloaded.readWorkspace('ws-1')).toEqual(TOKENS)
    expect(reloaded.readWorkspace('ws-2')).toEqual(other)

    reloaded.clear()
    expect(reloaded.readWorkspace('ws-1')).toBeUndefined()
    expect(storage.items.size).toBe(0)
  })

  it('reads the tokens another tab stored after an earlier read', () => {
    const storage = memoryStorage()
    const store = createStorageTokenStore(storage, new EventTarget())
    store.write(TOKENS)
    store.read()
    const rotated = { ...TOKENS, refreshToken: 'refresh-2' }

    createStorageTokenStore(storage, new EventTarget()).write(rotated)

    expect(store.read()).toEqual(rotated)
  })

  it('reports a write the storage refused and keeps nothing', () => {
    const storage = {
      ...memoryStorage(),
      setItem: () => {
        throw new DOMException('quota exceeded', 'QuotaExceededError')
      }
    }
    const store = createStorageTokenStore(storage, new EventTarget())

    expect(store.write(TOKENS)).toBe(false)
    expect(store.read()).toBeUndefined()
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

  it('forgets one workspace and keeps the others', () => {
    const storage = memoryStorage()
    const store = createStorageTokenStore(storage, new EventTarget())
    const other = { ...TOKENS, accessToken: 'access-2' }
    store.writeWorkspace('ws-1', TOKENS)
    store.writeWorkspace('ws-2', other)

    store.forgetWorkspace('ws-1', TOKENS)

    const reloaded = createStorageTokenStore(storage, new EventTarget())
    expect(reloaded.readWorkspace('ws-1')).toBeUndefined()
    expect(reloaded.readWorkspace('ws-2')).toEqual(other)
  })

  it('keeps a workspace whose tokens were replaced after the stale read', () => {
    const store = createStorageTokenStore(memoryStorage(), new EventTarget())
    const renewed = { ...TOKENS, refreshToken: 'refresh-2' }
    store.writeWorkspace('ws-1', renewed)

    store.forgetWorkspace('ws-1', TOKENS)

    expect(store.readWorkspace('ws-1')).toEqual(renewed)
  })

  it('forgets the tokens on clear', () => {
    const storage = memoryStorage()
    const store = createStorageTokenStore(storage, new EventTarget())
    store.write(TOKENS)

    store.clear()

    expect(store.read()).toBeUndefined()
    expect(storage.items.has(LOCAL_WEB_TOKENS_KEY)).toBe(false)
  })

  it('reports a change another tab made to its keys, and only its keys', () => {
    const events = new EventTarget()
    const store = createStorageTokenStore(memoryStorage(), events)
    const listener = vi.fn()
    store.subscribe(listener)

    events.dispatchEvent(storageEvent('Comfy.Other'))
    events.dispatchEvent(storageEvent(LOCAL_WEB_TOKENS_KEY))
    events.dispatchEvent(storageEvent('Comfy.LocalWebSignIn.WorkspaceTokens'))
    events.dispatchEvent(storageEvent(null))

    expect(listener).toHaveBeenCalledTimes(3)
  })
})
