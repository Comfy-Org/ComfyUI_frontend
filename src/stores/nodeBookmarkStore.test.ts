import { fromPartial } from '@total-typescript/shoehorn'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

import { useNodeBookmarkStore } from './nodeBookmarkStore'

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn()
}))

vi.mock('@/stores/nodeDefStore', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNodeDefStore: () => ({ allNodeDefsByName: {} })
}))

const set = vi.fn()
let bookmarks: string[]

const folder = (nodePath: string) =>
  fromPartial<ComfyNodeDefImpl>({
    category: nodePath.slice(0, -1),
    nodePath,
    isDummyFolder: true
  })

const nonFolder = fromPartial<ComfyNodeDefImpl>({
  category: '',
  nodePath: 'KSampler',
  isDummyFolder: false
})

describe('node bookmark folder commands', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    bookmarks = ['Folder/', 'Folder/KSampler', 'Existing/']
    vi.mocked(useSettingStore).mockReturnValue(
      fromPartial<ReturnType<typeof useSettingStore>>({
        get: vi.fn((id: string) =>
          id === 'Comfy.NodeLibrary.Bookmarks.V2' ? bookmarks : {}
        ),
        set
      })
    )
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it.for([
    {
      name: 'non-folder rename',
      command: () =>
        useNodeBookmarkStore().renameBookmarkFolder(nonFolder, 'Renamed')
    },
    {
      name: 'invalid name',
      command: () =>
        useNodeBookmarkStore().renameBookmarkFolder(
          folder('Folder/'),
          'Invalid/Name'
        )
    },
    {
      name: 'duplicate destination',
      command: () =>
        useNodeBookmarkStore().renameBookmarkFolder(
          folder('Folder/'),
          'Existing'
        )
    },
    {
      name: 'non-folder delete',
      command: () => useNodeBookmarkStore().deleteBookmarkFolder(nonFolder)
    }
  ])('does not persist $name', async ({ command }) => {
    const originalBookmarks = [...bookmarks]
    await expect(command()).resolves.toBe(false)
    expect(bookmarks).toEqual(originalBookmarks)
    expect(set).not.toHaveBeenCalled()
  })
})
