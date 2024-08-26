import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useSettingStore } from './settingStore'
import { useNodeDefStore } from './nodeDefStore'
import { ComfyNodeDefImpl, createDummyFolderNodeDef } from './nodeDefStore'
import { buildNodeDefTree } from './nodeDefStore'
import type { TreeNode } from 'primevue/treenode'
import _ from 'lodash'

export const useNodeBookmarkStore = defineStore('nodeBookmark', () => {
  const settingStore = useSettingStore()
  const nodeDefStore = useNodeDefStore()

  const bookmarks = computed<string[]>(() =>
    settingStore.get('Comfy.NodeLibrary.Bookmarks')
  )

  const bookmarksSet = computed<Set<string>>(() => new Set(bookmarks.value))

  const bookmarkedRoot = computed<TreeNode>(() =>
    buildBookmarkTree(bookmarks.value)
  )

  // For a node in custom bookmark folders, check if its nodePath is in bookmarksSet
  // For a node in the nodeDefStore, check if its name is bookmarked at top level
  const isBookmarked = (node: ComfyNodeDefImpl) =>
    bookmarksSet.value.has(node.nodePath) ||
    bookmarksSet.value.has(node.display_name)

  const toggleBookmark = (node: ComfyNodeDefImpl) => {
    if (isBookmarked(node)) {
      deleteBookmark(node.nodePath)
    } else {
      addBookmark(node.display_name)
    }
  }

  const buildBookmarkTree = (bookmarks: string[]) => {
    const bookmarkNodes = bookmarks
      .map((bookmark: string) => {
        if (bookmark.endsWith('/')) return createDummyFolderNodeDef(bookmark)

        const parts = bookmark.split('/')
        const displayName = parts.pop()
        const category = parts.join('/')
        const srcNodeDef = nodeDefStore.nodeDefsByDisplayName[displayName]
        if (!srcNodeDef) {
          return null
        }
        const nodeDef = _.clone(srcNodeDef)
        nodeDef.category = category
        return nodeDef
      })
      .filter((nodeDef) => nodeDef !== null)
    return buildNodeDefTree(bookmarkNodes)
  }

  const addBookmark = (nodePath: string) => {
    settingStore.set('Comfy.NodeLibrary.Bookmarks', [
      ...bookmarks.value,
      nodePath
    ])
  }

  const deleteBookmark = (nodePath: string) => {
    settingStore.set(
      'Comfy.NodeLibrary.Bookmarks',
      bookmarks.value.filter((b: string) => b !== nodePath)
    )
  }

  const addNewBookmarkFolder = (parent?: ComfyNodeDefImpl) => {
    const parentPath = parent ? parent.nodePath : ''
    let newFolderPath = parentPath + 'New Folder/'
    let suffix = 1
    while (bookmarks.value.some((b: string) => b.startsWith(newFolderPath))) {
      newFolderPath = parentPath + `New Folder ${suffix}/`
      suffix++
    }
    addBookmark(newFolderPath)
    return newFolderPath
  }

  const renameBookmarkFolder = (
    folderNode: ComfyNodeDefImpl,
    newName: string
  ) => {
    if (!folderNode.isDummyFolder) {
      throw new Error('Cannot rename non-folder node')
    }

    const newNodePath =
      folderNode.category.split('/').slice(0, -1).concat(newName).join('/') +
      '/'

    if (newNodePath === folderNode.nodePath) {
      return
    }

    if (bookmarks.value.some((b: string) => b.startsWith(newNodePath))) {
      throw new Error(`Folder name "${newNodePath}" already exists`)
    }

    settingStore.set(
      'Comfy.NodeLibrary.Bookmarks',
      bookmarks.value.map((b: string) =>
        b.startsWith(folderNode.nodePath)
          ? b.replace(folderNode.nodePath, newNodePath)
          : b
      )
    )
  }

  const deleteBookmarkFolder = (folderNode: ComfyNodeDefImpl) => {
    if (!folderNode.isDummyFolder) {
      throw new Error('Cannot delete non-folder node')
    }
    settingStore.set(
      'Comfy.NodeLibrary.Bookmarks',
      bookmarks.value.filter(
        (b: string) =>
          b !== folderNode.nodePath && !b.startsWith(folderNode.nodePath)
      )
    )
  }

  return {
    bookmarks,
    bookmarkedRoot,
    isBookmarked,
    toggleBookmark,
    addBookmark,
    addNewBookmarkFolder,
    renameBookmarkFolder,
    deleteBookmarkFolder
  }
})
