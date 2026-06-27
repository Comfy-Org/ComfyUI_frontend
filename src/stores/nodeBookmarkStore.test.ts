import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'

const BOOKMARK_ID = 'Comfy.NodeLibrary.Bookmarks.V2'
const CUSTOMIZATION_ID = 'Comfy.NodeLibrary.BookmarksCustomization'

const { settings, setSpy, nodeDefs } = vi.hoisted(() => ({
  settings: {} as Record<string, unknown>,
  setSpy: vi.fn(async (id: string, value: unknown) => {
    settings[id] = value
  }),
  nodeDefs: {} as Record<string, unknown>
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (id: string) => settings[id],
    set: setSpy
  })
}))

vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: () => ({ allNodeDefsByName: nodeDefs }),
  buildNodeDefTree: (defs: unknown[]) => ({ key: 'root', children: defs }),
  createDummyFolderNodeDef: (path: string) => ({
    isDummyFolder: true,
    nodePath: path,
    name: path
  })
}))

// A dummy folder's category is its nodePath without the trailing slash; the
// store derives the renamed path from category, so this relationship matters.
function folderNode(nodePath: string) {
  return {
    isDummyFolder: true,
    nodePath,
    category: nodePath.replace(/\/$/, ''),
    name: nodePath
  } as never
}

function leafNode(name: string, nodePath = name) {
  return { isDummyFolder: false, name, nodePath, category: '' } as never
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

    expect(setSpy).toHaveBeenCalledWith(BOOKMARK_ID, ['KSampler'])
    expect(setSpy).toHaveBeenCalledWith(BOOKMARK_ID, ['sampling/KSampler'])
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
    expect(children).toHaveLength(2) // KSampler clone + dummy folder, Unknown dropped
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
      const store = useNodeBookmarkStore()

      await store.renameBookmarkFolder(folderNode('Old/'), 'New')

      expect(setSpy).toHaveBeenCalledWith(BOOKMARK_ID, [
        'New/',
        'New/KSampler',
        'Other/Node'
      ])
    })
  })

  it('deletes a folder and all its descendants', async () => {
    settings[BOOKMARK_ID] = ['Old/', 'Old/KSampler', 'Keep/Node']
    const store = useNodeBookmarkStore()

    await store.deleteBookmarkFolder(folderNode('Old/'))

    expect(setSpy).toHaveBeenCalledWith(BOOKMARK_ID, ['Keep/Node'])
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

      // Both attributes equal defaults -> customization becomes empty -> deleted
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
