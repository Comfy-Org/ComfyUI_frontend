import { defineStore } from 'pinia'
import { api } from '@/scripts/api'
import { buildTree } from '@/utils/treeUtil'
import { computed, ref } from 'vue'
import { TreeExplorerNode } from '@/types/treeExplorerTypes'
import { UserDataFullInfo } from '@/types/apiTypes'

/**
 * Represents a file in the user's data directory.
 */
export class UserFile {
  /**
   * Various path components.
   * Example:
   * - path: 'dir/file.txt'
   * - directory: 'dir'
   * - fullFilename: 'file.txt'
   * - filename: 'file'
   * - suffix: 'txt'
   */
  directory: string
  fullFilename: string
  filename: string
  suffix: string | null

  isLoading: boolean = false
  content: string | null = null
  originalContent: string | null = null

  constructor(
    /**
     * Path relative to ComfyUI/user/ directory.
     */
    public path: string,
    /**
     * Last modified timestamp.
     */
    public lastModified: number,
    /**
     * File size in bytes.
     */
    public size: number
  ) {
    this.directory = path.split('/').slice(0, -1).join('/')
    this.fullFilename = path.split('/').pop() ?? path
    this.filename = this.fullFilename.split('.').slice(0, -1).join('.')
    this.suffix = this.fullFilename.split('.').pop() ?? null
  }

  get isOpen() {
    return !!this.content
  }

  get isModified() {
    return this.content !== this.originalContent
  }

  async load(): Promise<UserFile> {
    this.isLoading = true
    const resp = await api.getUserData(this.path)
    if (resp.status !== 200) {
      throw new Error(
        `Failed to load file '${this.path}': ${resp.status} ${resp.statusText}`
      )
    }
    this.content = await resp.text()
    this.originalContent = this.content
    this.isLoading = false
    return this
  }

  async saveAs(newPath: string): Promise<UserFile> {
    const tempFile = new TempUserFile(newPath, this.content ?? undefined)
    await tempFile.save()
    return tempFile
  }

  async save(): Promise<UserFile> {
    if (!this.isModified) return this

    const resp = await api.storeUserData(this.path, this.content, {
      throwOnError: true,
      full_info: true
    })

    // Note: Backend supports full_info=true feature after
    // https://github.com/comfyanonymous/ComfyUI/pull/5446
    const updatedFile = (await resp.json()) as string | UserDataFullInfo
    if (typeof updatedFile === 'object') {
      this.lastModified = updatedFile.modified
      this.size = updatedFile.size
    }
    this.originalContent = this.content
    return this
  }

  async delete(): Promise<void> {
    const resp = await api.deleteUserData(this.path)
    if (resp.status !== 204) {
      throw new Error(
        `Failed to delete file '${this.path}': ${resp.status} ${resp.statusText}`
      )
    }
  }

  async rename(newPath: string): Promise<UserFile> {
    const resp = await api.moveUserData(this.path, newPath)
    if (resp.status !== 200) {
      throw new Error(
        `Failed to rename file '${this.path}': ${resp.status} ${resp.statusText}`
      )
    }
    this.path = newPath
    // Note: Backend supports full_info=true feature after
    // https://github.com/comfyanonymous/ComfyUI/pull/5446
    const updatedFile = (await resp.json()) as string | UserDataFullInfo
    if (typeof updatedFile === 'object') {
      this.lastModified = updatedFile.modified
      this.size = updatedFile.size
    }
    return this
  }
}

export class TempUserFile extends UserFile {
  constructor(path: string, content: string = '') {
    // Initialize with current timestamp and 0 size since it's temporary
    super(path, Date.now(), 0)
    this.content = content
    this.originalContent = content
  }

  // Override methods that interact with backend
  async load(): Promise<TempUserFile> {
    // No need to load as it's a temporary file
    return this
  }

  async save(): Promise<TempUserFile> {
    // First save should create the actual file on the backend
    const resp = await api.storeUserData(this.path, this.content, {
      throwOnError: true,
      full_info: true
    })

    const updatedFile = (await resp.json()) as string | UserDataFullInfo
    if (typeof updatedFile === 'object') {
      this.lastModified = updatedFile.modified
      this.size = updatedFile.size
    }
    this.originalContent = this.content
    return this
  }

  async delete(): Promise<void> {
    // No need to delete from backend as it doesn't exist there
  }

  async rename(newPath: string): Promise<TempUserFile> {
    // Just update the path locally since it's not on backend yet
    this.path = newPath
    return this
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

  const fileTree = computed<TreeExplorerNode<UserFile>>(
    () =>
      buildTree<UserFile>(userFiles.value, (userFile: UserFile) =>
        userFile.path.split('/')
      ) as TreeExplorerNode<UserFile>
  )

  /**
   * Syncs the files in the given directory with the API.
   * @param dir The directory to sync.
   */
  const syncFiles = async (dir: string = '') => {
    const files = await api.listUserDataFullInfo(dir)

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

  return {
    userFiles,
    modifiedFiles,
    openedFiles,
    fileTree,
    syncFiles
  }
})
