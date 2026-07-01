import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useExtensionStore } from '@/stores/extensionStore'
import { useTopbarBadgeStore } from '@/stores/topbarBadgeStore'

describe('topbarBadgeStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('collects topbar badges from registered extensions', () => {
    const extensionStore = useExtensionStore()
    extensionStore.registerExtension({
      name: 'badges',
      topbarBadges: [{ text: 'Beta', label: 'BETA' }]
    })
    extensionStore.registerExtension({ name: 'plain' })

    const store = useTopbarBadgeStore()

    expect(store.badges).toEqual([{ text: 'Beta', label: 'BETA' }])
  })
})
