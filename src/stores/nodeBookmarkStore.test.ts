import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

const BOOKMARK_ID = 'Comfy.NodeLibrary.Bookmarks.V2'
const CUSTOMIZATION_ID = 'Comfy.NodeLibrary.BookmarksCustomization'

const { settings, setSpy, nodeDefs } = vi.hoisted(() => ({
  settings: {} as Record<string, unknown>,
  setSpy: vi.fn(),
  nodeDefs: {} as Record<string, unknown>
}))

vi.mock('@/platform/settings/settingStore', async () => {
  const { reactive } = await import('vue')
  const reactiveSettings = reactive(settings)
  setSpy.mockImplementation(async (id: string, value: unknown) => {
    reactiveSettings[id] = value
  })
  return {
    useSettingStore: () => ({
      get: (id: string) => reactiveSettings[id],
      set: setSpy
    })
  }
})

vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: () => ({ allNodeDefsByName: nodeDefs }),
  buildNodeDefTree: (defs: unknown[]) => ({ key: 'root', children: defs }),
  createDummyFolderNodeDef: (path: string) => ({
    isDummyFolder: true,
    nodePath: path,
    name: path
  })
}))

type BookmarkNodeFixture = Pick<
  ComfyNodeDefImpl,
  'isDummyFolder' | 'nodePath' | 'category' | 'name'
>

function folderNode(nodePath: string) {
  const node = {
    isDummyFolder: true,
    nodePath,
    category: nodePath.replace(/\/$/, ''),
    name: nodePath
  } satisfies BookmarkNodeFixture
  return node as ComfyNodeDefImpl
}

function leafNode(name: string, nodePath = name) {
  const node = {
    isDummyFolder: false,
    name,
    nodePath,
    category: ''
  } satisfies BookmarkNodeFixture
  return node as ComfyNodeDefImpl
}

beforeEach(() => {
  setActivePinia(createPinia())
  for (const key of Object.keys(settings)) delete settings[key]
  for (const key of Object.keys(nodeDefs)) delete nodeDefs[key]
  settings[BOOKMARK_ID] = []
  settings[CUSTOMIZATION_ID] = {}
  setSpy.mockClear()
})

describe('nodeBookmarkStore', () => {
  it('reports isBookmarked by either nodePath or top-level name', () => {
    settings[BOOKMARK_ID] = ['sampling/KSampler', 'LoadImage']
    const store = useNodeBookmarkStore()

    expect(store.isBookmarked(leafNode('KSampler', 'sampling/KSampler'))).toBe(
      true
    )
    expect(store.isBookmarked(leafNode('LoadImage'))).toBe(true)
    expect(store.isBookmarked(leafNode('VAEDecode'))).toBe(false)
  })

  it('adds a bookmark by appending to the current list', async () => {
    settings[BOOKMARK_ID] = ['A']
    const store = useNodeBookmarkStore()

    await store.addBookmark('B')

    expect(setSpy).toHaveBeenCalledWith(BOOKMARK_ID, ['A', 'B'])
  })

  it('toggles an un-bookmarked node by adding its name', async () => {
    const store = useNodeBookmarkStore()

    await store.toggleBookmark(leafNode('KSampler'))

    expect(setSpy).toHaveBeenCalledWith(BOOKMARK_ID, ['KSampler'])
  })

  it('toggles a bookmarked node by deleting both nodePath and name', async () => {
    settings[BOOKMARK_ID] = ['sampling/KSampler', 'KSampler']
    const store = useNodeBookmarkStore()

    await store.toggleBookmark(leafNode('KSampler', 'sampling/KSampler'))

    expect(setSpy).toHaveBeenLastCalledWith(BOOKMARK_ID, [])
    expect(store.bookmarks).toEqual([])
  })

  it('creates a folder under a parent and at the root', async () => {
    const store = useNodeBookmarkStore()

    const rootPath = await store.addNewBookmarkFolder(undefined, 'Favorites')
    expect(rootPath).toBe('Favorites/')

    const childPath = await store.addNewBookmarkFolder(
      folderNode('Favorites/'),
      'Nested'
    )
    expect(childPath).toBe('Favorites/Nested/')
  })

  it('builds the bookmark tree, dropping unknown node defs', () => {
    nodeDefs['KSampler'] = leafNode('KSampler')
    settings[BOOKMARK_ID] = ['sampling/KSampler', 'sampling/Unknown', 'Folder/']
    const store = useNodeBookmarkStore()

    const children = (store.bookmarkedRoot as { children: unknown[] }).children
    expect(children).toHaveLength(2)
  })

  describe('renameBookmarkFolder', () => {
    it('rejects renaming a non-folder node', async () => {
      const store = useNodeBookmarkStore()
      await expect(
        store.renameBookmarkFolder(leafNode('KSampler'), 'New')
      ).rejects.toThrow('Cannot rename non-folder node')
    })

    it('rejects a name containing a slash', async () => {
      const store = useNodeBookmarkStore()
      await expect(
        store.renameBookmarkFolder(folderNode('Old/'), 'a/b')
      ).rejects.toThrow('cannot contain')
    })

    it('rejects a rename that collides with an existing folder', async () => {
      settings[BOOKMARK_ID] = ['Taken/']
      const store = useNodeBookmarkStore()
      await expect(
        store.renameBookmarkFolder(folderNode('Old/'), 'Taken')
      ).rejects.toThrow('already exists')
    })

    it('rewrites matching bookmark paths on a valid rename', async () => {
      settings[BOOKMARK_ID] = ['Old/', 'Old/KSampler', 'Other/Node']
      settings[CUSTOMIZATION_ID] = { 'Old/': { color: '#abc' } }
      const store = useNodeBookmarkStore()

      await store.renameBookmarkFolder(folderNode('Old/'), 'New')

      expect(setSpy).toHaveBeenCalledWith(BOOKMARK_ID, [
        'New/',
        'New/KSampler',
        'Other/Node'
      ])
      expect(setSpy).toHaveBeenCalledWith(CUSTOMIZATION_ID, {
        'New/': { color: '#abc' }
      })
    })

    it('does nothing when the folder keeps the same path', async () => {
      const store = useNodeBookmarkStore()

      await store.renameBookmarkFolder(folderNode('Old/'), 'Old')

      expect(setSpy).not.toHaveBeenCalled()
    })
  })

  it('deletes a folder and all its descendants', async () => {
    settings[BOOKMARK_ID] = ['Old/', 'Old/KSampler', 'Keep/Node']
    settings[CUSTOMIZATION_ID] = { 'Old/': { color: '#abc' } }
    const store = useNodeBookmarkStore()

    await store.deleteBookmarkFolder(folderNode('Old/'))

    expect(settings[BOOKMARK_ID]).toEqual(['Keep/Node'])
    expect(
      (settings[CUSTOMIZATION_ID] as Record<string, unknown>)['Old/']
    ).toBeUndefined()
  })

  it('rejects deleting a non-folder node', async () => {
    const store = useNodeBookmarkStore()

    await expect(
      store.deleteBookmarkFolder(leafNode('KSampler'))
    ).rejects.toThrow('Cannot delete non-folder node')
  })

  describe('updateBookmarkCustomization', () => {
    it('persists a non-default customization', async () => {
      const store = useNodeBookmarkStore()

      await store.updateBookmarkCustomization('Folder/', {
        color: '#ff0000',
        icon: 'pi-star'
      })

      expect(setSpy).toHaveBeenCalledWith(CUSTOMIZATION_ID, {
        'Folder/': { color: '#ff0000', icon: 'pi-star' }
      })
    })

    it('drops attributes set to their default values', async () => {
      const store = useNodeBookmarkStore()

      await store.updateBookmarkCustomization('Folder/', {
        color: store.defaultBookmarkColor,
        icon: store.defaultBookmarkIcon
      })

      expect(setSpy).toHaveBeenCalledWith(CUSTOMIZATION_ID, {
        'Folder/': undefined
      })
    })
  })

  it('renames a customization entry, moving the old key to the new one', async () => {
    settings[CUSTOMIZATION_ID] = { 'Old/': { color: '#abc' } }
    const store = useNodeBookmarkStore()

    await store.renameBookmarkCustomization('Old/', 'New/')

    expect(setSpy).toHaveBeenCalledWith(CUSTOMIZATION_ID, {
      'New/': { color: '#abc' }
    })
  })
})
