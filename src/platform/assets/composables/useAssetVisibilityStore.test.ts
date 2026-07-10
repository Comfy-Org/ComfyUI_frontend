import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const distribution = vi.hoisted(() => ({ isCloud: true }))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return distribution.isCloud
  }
}))

import { useAssetVisibilityStore } from '@/platform/assets/composables/useAssetVisibilityStore'

describe('useAssetVisibilityStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    distribution.isCloud = true
  })

  it('treats every asset as private by default', () => {
    const store = useAssetVisibilityStore()

    expect(store.isShared('a')).toBe(false)
  })

  it('shares assets and reports them as shared', () => {
    const store = useAssetVisibilityStore()

    store.share(['a', 'b'])

    expect(store.isShared('a')).toBe(true)
    expect(store.isShared('b')).toBe(true)
  })

  it('unshares assets back to private without touching the others', () => {
    const store = useAssetVisibilityStore()

    store.share(['a', 'b'])
    store.unshare(['a'])

    expect(store.isShared('a')).toBe(false)
    expect(store.isShared('b')).toBe(true)
  })

  it('ignores unsharing an asset that was never shared', () => {
    const store = useAssetVisibilityStore()

    store.unshare(['ghost'])

    expect(store.isShared('ghost')).toBe(false)
  })

  it('ignores visibility reads and writes outside cloud builds', () => {
    const store = useAssetVisibilityStore()
    store.share(['existing'])

    distribution.isCloud = false
    expect(store.isShared('existing')).toBe(false)

    store.unshare(['existing'])
    store.share(['new'])

    distribution.isCloud = true
    expect(store.isShared('existing')).toBe(true)
    expect(store.isShared('new')).toBe(false)
  })
})
