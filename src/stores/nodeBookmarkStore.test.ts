import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

import { useNodeBookmarkStore } from './nodeBookmarkStore'

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
    const settingStore = useSettingStore()
    settingStore.settingValues['Comfy.NodeLibrary.Bookmarks.V2'] = [
      'Folder/',
      'Folder/KSampler',
      'Existing/'
    ]
    settingStore.settingValues['Comfy.NodeLibrary.BookmarksCustomization'] = {}
    vi.spyOn(settingStore, 'set').mockResolvedValue()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('omits bookmarks whose node definitions are no longer available', () => {
    useSettingStore().settingValues['Comfy.NodeLibrary.Bookmarks.V2'] = [
      'MissingNode'
    ]

    expect(useNodeBookmarkStore().bookmarkedRoot.children).toEqual([])
  })

  it.fails.for([
    {
      name: 'non-folder node',
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
    }
  ])('does not persist a rename with $name', async ({ command, error }) => {
    const settingStore = useSettingStore()
    const originalBookmarks = [
      ...(settingStore.settingValues['Comfy.NodeLibrary.Bookmarks.V2'] ?? [])
    ]
    await command()
    expect(
      settingStore.settingValues['Comfy.NodeLibrary.Bookmarks.V2']
    ).toEqual(originalBookmarks)
    expect(settingStore.set).not.toHaveBeenCalled()
    expect(useToastStore().messagesToAdd).toContainEqual(
      expect.objectContaining({ severity: 'error', detail: error })
    )
  })

  it.fails('does not persist a non-folder deletion', async () => {
    const settingStore = useSettingStore()
    const originalBookmarks = [
      ...(settingStore.settingValues['Comfy.NodeLibrary.Bookmarks.V2'] ?? [])
    ]

    await expect(
      useNodeBookmarkStore().deleteBookmarkFolder(nonFolder)
    ).resolves.toBe(false)

    expect(
      settingStore.settingValues['Comfy.NodeLibrary.Bookmarks.V2']
    ).toEqual(originalBookmarks)
    expect(settingStore.set).not.toHaveBeenCalled()
  })

  it('accepts an unchanged folder name without persisting', async () => {
    const settingStore = useSettingStore()
    await useNodeBookmarkStore().renameBookmarkFolder(
      folder('Folder/'),
      'Folder'
    )
    expect(settingStore.set).not.toHaveBeenCalled()
  })

  it('persists a successful folder rename', async () => {
    const settingStore = useSettingStore()
    await useNodeBookmarkStore().renameBookmarkFolder(
      folder('Folder/'),
      'Renamed'
    )
    expect(settingStore.set).toHaveBeenNthCalledWith(
      1,
      'Comfy.NodeLibrary.Bookmarks.V2',
      ['Renamed/', 'Renamed/KSampler', 'Existing/']
    )
  })

  it.fails('persists a successful folder deletion', async () => {
    const settingStore = useSettingStore()
    await expect(
      useNodeBookmarkStore().deleteBookmarkFolder(folder('Folder/'))
    ).resolves.toBe(true)
    expect(settingStore.set).toHaveBeenNthCalledWith(
      1,
      'Comfy.NodeLibrary.Bookmarks.V2',
      ['Existing/']
    )
  })
})
