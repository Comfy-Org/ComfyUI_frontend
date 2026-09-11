import { describe, expect, it } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'

describe('useNodeBookmarkStore', () => {
  it('omits bookmarks whose node definitions are no longer available', () => {
    useSettingStore().settingValues['Comfy.NodeLibrary.Bookmarks.V2'] = [
      'MissingNode'
    ]

    const store = useNodeBookmarkStore()

    expect(store.bookmarkedRoot.children).toEqual([])
  })
})
