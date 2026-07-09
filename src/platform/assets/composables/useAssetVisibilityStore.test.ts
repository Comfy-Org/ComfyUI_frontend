import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useAssetVisibilityStore } from '@/platform/assets/composables/useAssetVisibilityStore'

describe('useAssetVisibilityStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
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
})
