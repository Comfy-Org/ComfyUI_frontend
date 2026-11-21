import { describe, expect, it, vi } from 'vitest'

import { publishedApi } from '@/platform/nodeApi/v4/__tests__/publishedApi'
import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'

import { useActionBarButtonStore } from './actionBarButtonStore'

describe('the action bar buttons', () => {
  it('lists the buttons packs add through the node API after those of extensions, and drops a removed one', () => {
    const fromExtension = { icon: 'icon-[lucide--a]', onClick: vi.fn() }
    useExtensionStore().registerExtension({
      name: 'Legacy.Extension',
      actionBarButtons: [fromExtension]
    })
    const added = publishedApi().ui.addActionBarButton({
      id: 'MyPack.open',
      icon: 'icon-[lucide--camera]',
      label: 'Open',
      run: vi.fn()
    })
    const store = useActionBarButtonStore()

    expect(store.buttons.map(({ icon }) => icon)).toEqual([
      'icon-[lucide--a]',
      'icon-[lucide--camera]'
    ])
    added.remove()
    expect(store.buttons.map(({ icon }) => icon)).toEqual(['icon-[lucide--a]'])
  })
})
