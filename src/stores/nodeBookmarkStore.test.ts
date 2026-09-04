import { fromPartial } from '@total-typescript/shoehorn'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
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
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it.for([
    {
      name: 'non-folder rename',
      error: 'Cannot rename non-folder node',
      command: () =>
        useNodeBookmarkStore().renameBookmarkFolder(nonFolder, 'Renamed')
    },
    {
      name: 'invalid name',
      error: 'Folder name cannot contain "/"',
      command: () =>
        useNodeBookmarkStore().renameBookmarkFolder(
          folder('Folder/'),
          'Invalid/Name'
        )
    },
    {
      name: 'duplicate destination',
      error: 'Folder name "Existing/" already exists',
      command: () =>
        useNodeBookmarkStore().renameBookmarkFolder(
          folder('Folder/'),
          'Existing'
        )
    },
    {
      name: 'unchanged path',
      error: undefined,
      command: () =>
        useNodeBookmarkStore().renameBookmarkFolder(folder('Folder/'), 'Folder')
    },
    {
      name: 'non-folder delete',
      error: undefined,
      command: () => useNodeBookmarkStore().deleteBookmarkFolder(nonFolder)
    }
  ])('does not persist $name', async ({ command, error }) => {
    const originalBookmarks = [...bookmarks]
    await expect(command()).resolves.toBe(false)
    expect(bookmarks).toEqual(originalBookmarks)
    expect(set).not.toHaveBeenCalled()
    if (error) {
      expect(useToastStore().messagesToAdd).toContainEqual(
        expect.objectContaining({ severity: 'error', detail: error })
      )
    }
  })

  it('persists a successful folder rename', async () => {
    await expect(
      useNodeBookmarkStore().renameBookmarkFolder(folder('Folder/'), 'Renamed')
    ).resolves.toBe(true)
    expect(set).toHaveBeenNthCalledWith(1, 'Comfy.NodeLibrary.Bookmarks.V2', [
      'Renamed/',
      'Renamed/KSampler',
      'Existing/'
    ])
  })

  it('persists a successful folder deletion', async () => {
    await expect(
      useNodeBookmarkStore().deleteBookmarkFolder(folder('Folder/'))
    ).resolves.toBe(true)
    expect(set).toHaveBeenNthCalledWith(1, 'Comfy.NodeLibrary.Bookmarks.V2', [
      'Existing/'
    ])
  })
})
