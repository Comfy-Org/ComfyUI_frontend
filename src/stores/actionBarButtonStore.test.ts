import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useActionBarButtonStore } from '@/stores/actionBarButtonStore'
import { useExtensionStore } from '@/stores/extensionStore'

describe('actionBarButtonStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('collects action bar buttons from registered extensions', () => {
    const extensionStore = useExtensionStore()
    const onClick = vi.fn()
    extensionStore.registerExtension({
      name: 'buttons',
      actionBarButtons: [{ icon: 'icon-[lucide--plus]', onClick }]
    })
    extensionStore.registerExtension({ name: 'plain' })

    const store = useActionBarButtonStore()

    expect(store.buttons).toEqual([{ icon: 'icon-[lucide--plus]', onClick }])
  })
})
