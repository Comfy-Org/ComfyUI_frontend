import { defineStore } from 'pinia'
import { api } from '@/scripts/api'
import { buildTree } from '@/utils/treeUtil'
import { computed, ref } from 'vue'
import { TreeExplorerNode } from '@/types/treeExplorerTypes'

class UserFile {
  isLoading: boolean = false
  content: string | null = null
  originalContent: string | null = null

  constructor(
    public path: string,
    public lastModified: number,
    public size: number
  ) {}

  get isOpen() {
    return !!this.content
  }

  get isModified() {
    return this.content !== this.originalContent
  }
}

export const useUserFileStore = defineStore('userFile', () => {
  const userFilesByPath = ref(new Map<string, UserFile>())

  const userFiles = computed(() => Array.from(userFilesByPath.value.values()))
  const modifiedFiles = computed(() =>
    userFiles.value.filter((file: UserFile) => file.isModified)
  )
  const openedFiles = computed(() =>
    userFiles.value.filter((file: UserFile) => file.isOpen)
  )

  const workflowsTree = computed<TreeExplorerNode<UserFile>>(
    () =>
      buildTree<UserFile>(userFiles.value, (userFile: UserFile) =>
        userFile.path.split('/')
      ) as TreeExplorerNode<UserFile>
  )

  /**
   * Syncs the files in the given directory with the API.
   * @param dir The directory to sync.
   */
  const syncFiles = async () => {
    const files = await api.listUserDataFullInfo('')

    for (const file of files) {
      const existingFile = userFilesByPath.value.get(file.path)

      if (!existingFile) {
        // New file, add it to the map
        userFilesByPath.value.set(
          file.path,
          new UserFile(file.path, file.modified, file.size)
        )
      } else if (existingFile.lastModified !== file.modified) {
        // File has been modified, update its properties
        existingFile.lastModified = file.modified
        existingFile.size = file.size
        existingFile.originalContent = null
        existingFile.content = null
        existingFile.isLoading = false
      }
    }

    // Remove files that no longer exist
    for (const [path, _] of userFilesByPath.value) {
      if (!files.some((file) => file.path === path)) {
        userFilesByPath.value.delete(path)
      }
    }
  }

  const loadFile = async (file: UserFile) => {
    file.isLoading = true
    const resp = await api.getUserData(file.path)
    if (resp.status !== 200) {
      throw new Error(
        `Failed to load file '${file.path}': ${resp.status} ${resp.statusText}`
      )
    }
    file.content = await resp.text()
    file.originalContent = file.content
    file.isLoading = false
  }

  const saveFile = async (file: UserFile) => {
    if (file.isModified) {
      const resp = await api.storeUserData(file.path, file.content)
      if (resp.status !== 200) {
        throw new Error(
          `Failed to save file '${file.path}': ${resp.status} ${resp.statusText}`
        )
      }
    }
    await syncFiles()
  }

  const deleteFile = async (file: UserFile) => {
    const resp = await api.deleteUserData(file.path)
    if (resp.status !== 204) {
      throw new Error(
        `Failed to delete file '${file.path}': ${resp.status} ${resp.statusText}`
      )
    }
    await syncFiles()
  }

  const renameFile = async (file: UserFile, newPath: string) => {
    const resp = await api.moveUserData(file.path, newPath)
    if (resp.status !== 200) {
      throw new Error(
        `Failed to rename file '${file.path}': ${resp.status} ${resp.statusText}`
      )
    }
    file.path = newPath
    userFilesByPath.value.set(newPath, file)
    userFilesByPath.value.delete(file.path)
    await syncFiles()
  }

  return {
    userFiles,
    modifiedFiles,
    openedFiles,
    workflowsTree,
    syncFiles,
    loadFile,
    saveFile,
    deleteFile,
    renameFile
  }
})
