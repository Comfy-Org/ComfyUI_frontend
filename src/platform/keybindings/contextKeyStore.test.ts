import { describe, expect, it, vi } from 'vitest'

import { useContextKeyStore } from './contextKeyStore'

describe('useContextKeyStore', () => {
  it('exposes registered keys in the snapshot and updates them', () => {
    const store = useContextKeyStore()

    expect(store.register('ext.wasdMode', 'ext')).toBe(true)
    expect(store.snapshot()).toMatchObject({
      'ext.wasdMode': false,
      modalOpen: false,
      textInputFocus: false
    })

    expect(store.set('ext.wasdMode', true)).toBe(true)
    expect(store.snapshot()['ext.wasdMode']).toBe(true)
    expect(store.ownerOf('ext.wasdMode')).toBe('ext')
  })

  it('ignores writes to keys nobody registered', () => {
    const store = useContextKeyStore()
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(store.set('nope', true)).toBe(false)
    expect('nope' in store.snapshot()).toBe(false)
  })

  it('lets an owner re-register its key but not take another owner’s', () => {
    const store = useContextKeyStore()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    store.register('shared', 'a')
    store.set('shared', true)

    expect(store.register('shared', 'a')).toBe(true)
    expect(store.snapshot().shared).toBe(true)
    expect(store.register('shared', 'b')).toBe(false)
    expect(store.ownerOf('shared')).toBe('a')
  })

  it('rejects names the when grammar cannot reference', () => {
    const store = useContextKeyStore()
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(store.register('has space', 'a')).toBe(false)
    expect(store.register('1leading', 'a')).toBe(false)
  })
})
