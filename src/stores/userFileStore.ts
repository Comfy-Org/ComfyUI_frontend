import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { UserDataFullInfo } from '@comfyorg/api-client/types'
import { api } from '@/scripts/api'
import {
  SavedFileIdentityError,
  SavedFilePathUnavailableError,
  sameUserFileIdentity,
  sameUserFileScope
} from '@/platform/workflow/core/utils/userFileIdentity'
import {
  currentUserFileScope,
  receivedUserFileIdentity
} from '@/platform/workflow/core/services/userFileContext'
import type { UserFileIdentity } from '@/platform/workflow/core/utils/userFileIdentity'
import type { TreeExplorerNode } from '@/types/treeExplorerTypes'
import { getPathDetails } from '@/utils/formatUtil'
import { syncEntities } from '@/utils/syncUtil'
import { buildTree } from '@/utils/treeUtil'

/**
 * Normalizes a timestamp value that may be either a number (milliseconds)
 * or an ISO 8601 string (from Go's time.Time JSON serialization) into
 * a consistent millisecond timestamp.
 */
function normalizeTimestamp(value: number | string): number {
  if (typeof value === 'string') {
    const ms = new Date(value).getTime()
    return Number.isNaN(ms) ? Date.now() : ms
  }
  return value
}

function fileLoadFailure(
  path: string,
  response: Response,
  identity: UserFileIdentity | undefined
): DOMException {
  if (identity && (response.status === 404 || response.status === 412))
    return new SavedFilePathUnavailableError(
      path,
      response.status,
      response.statusText
    )
  return new DOMException(
    `Failed to load file '${path}': ${response.status} ${response.statusText}`,
    response.status === 404 ? 'NotFoundError' : 'InvalidStateError'
  )
}

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
     * File size in bytes. -1 for temporary files.
     */
    public size: number,
    public savedFileIdentity?: UserFileIdentity
  ) {
    const details = getPathDetails(path)
    this.directory = details.directory
    this.fullFilename = details.fullFilename
    this.filename = details.filename
    this.suffix = details.suffix
  }

  isIdentityScopeCurrent(): boolean {
    return (
      !this.savedFileIdentity ||
      sameUserFileScope(this.savedFileIdentity, currentUserFileScope())
    )
  }

  assertIdentityScope(): void {
    if (!this.isIdentityScopeCurrent())
      throw new SavedFileIdentityError('scope')
  }

  updatePath(newPath: string) {
    const details = getPathDetails(newPath)
    this.path = newPath
    this.directory = details.directory
    this.fullFilename = details.fullFilename
    this.filename = details.filename
    this.suffix = details.suffix
  }

  static createTemporary(path: string): UserFile {
    return new UserFile(path, Date.now(), -1)
  }

  get isTemporary() {
    return this.size === -1
  }

  get isPersisted() {
    return !this.isTemporary
  }

  get key(): string {
    return this.path
  }

  get isLoaded() {
    return this.content !== null
  }

  get isModified() {
    return this.content !== this.originalContent
  }

  /**
   * Loads the file content from the remote storage.
   */
  async load({
    force = false
  }: { force?: boolean } = {}): Promise<LoadedUserFile> {
    this.assertIdentityScope()
    if (this.isTemporary || (!force && this.content !== null))
      return this as LoadedUserFile

    this.isLoading = true
    try {
      const resp = await api.getUserData(
        this.path,
        this.savedFileIdentity
          ? { expected_id: this.savedFileIdentity.id }
          : undefined
      )
      this.assertIdentityScope()
      if (resp.status !== 200)
        throw fileLoadFailure(this.path, resp, this.savedFileIdentity)
      const content = await resp.text()
      this.assertIdentityScope()
      this.content = content
      this.originalContent = this.content
      return this as LoadedUserFile
    } finally {
      this.isLoading = false
    }
  }

  /**
   * Unloads the file content from memory
   */
  unload(): void {
    this.content = null
    this.originalContent = null
    this.isLoading = false
  }

  async saveAs(newPath: string): Promise<UserFile> {
    this.assertIdentityScope()
    const tempFile = this.isTemporary ? this : UserFile.createTemporary(newPath)
    tempFile.content = this.content
    await tempFile.save()
    return tempFile
  }

  /**
   * Saves the file to the remote storage.
   * @param force Whether to force the save even if the file is not modified.
   */
  async save({
    force = false,
    signal
  }: { force?: boolean; signal?: AbortSignal } = {}): Promise<UserFile> {
    signal?.throwIfAborted()
    this.assertIdentityScope()
    const scope = currentUserFileScope()
    const requestScope = scope && { ...scope }
    const assertRequestScope = () => {
      const current = currentUserFileScope()
      if (
        requestScope === null
          ? current !== null
          : !sameUserFileScope(requestScope, current)
      )
        throw new SavedFileIdentityError('scope')
    }
    if (this.isPersisted && !this.isModified && !force) return this

    const resp = await api.storeUserData(this.path, this.content, {
      overwrite: this.isPersisted,
      throwOnError: true,
      full_info: true,
      ...(signal && { signal }),
      ...(this.savedFileIdentity && { expected_id: this.savedFileIdentity.id })
    })

    signal?.throwIfAborted()
    assertRequestScope()
    const updatedFile = (await resp.json()) as string | UserDataFullInfo
    this.assertIdentityScope()
    signal?.throwIfAborted()
    assertRequestScope()
    if (typeof updatedFile === 'object') {
      this.lastModified = normalizeTimestamp(updatedFile.modified)
      this.size = updatedFile.size
      this.savedFileIdentity ??= receivedUserFileIdentity(
        updatedFile.id,
        requestScope
      )
    }
    this.originalContent = this.content
    return this
  }

  async delete(options: { signal?: AbortSignal } = {}): Promise<void> {
    options.signal?.throwIfAborted()
    this.assertIdentityScope()
    if (this.isTemporary) return

    const resp = await (this.savedFileIdentity || options.signal
      ? api.deleteUserData(this.path, {
          ...(this.savedFileIdentity && {
            expected_id: this.savedFileIdentity.id
          }),
          ...(options.signal && { signal: options.signal })
        })
      : api.deleteUserData(this.path))
    this.assertIdentityScope()
    options.signal?.throwIfAborted()
    if (resp.status !== 204) {
      throw new DOMException(
        `Failed to delete file '${this.path}': ${resp.status} ${resp.statusText}`,
        resp.status === 404 ? 'NotFoundError' : 'InvalidStateError'
      )
    }
  }

  async rename(newPath: string): Promise<UserFile> {
    this.assertIdentityScope()
    if (this.isTemporary) {
      this.updatePath(newPath)
      return this
    }

    const resp = await (this.savedFileIdentity
      ? api.moveUserData(this.path, newPath, {
          overwrite: false,
          expected_id: this.savedFileIdentity.id
        })
      : api.moveUserData(this.path, newPath))
    this.assertIdentityScope()
    if (resp.status !== 200) {
      throw new DOMException(
        `Failed to rename file '${this.path}': ${resp.status} ${resp.statusText}`,
        resp.status === 404 ? 'NotFoundError' : 'InvalidStateError'
      )
    }
    const updatedFile = (await resp.json()) as string | UserDataFullInfo
    this.assertIdentityScope()
    this.updatePath(newPath)
    if (typeof updatedFile === 'object') {
      this.lastModified = normalizeTimestamp(updatedFile.modified)
      this.size = updatedFile.size
      this.savedFileIdentity ??= receivedUserFileIdentity(updatedFile.id)
    }
    return this
  }
}

interface LoadedUserFile extends UserFile {
  isLoaded: true
  originalContent: string
  content: string
}

export const useUserFileStore = defineStore('userFile', () => {
  const userFilesByPath = ref<Record<string, UserFile>>({})

  const userFiles = computed(() => Object.values(userFilesByPath.value))
  const modifiedFiles = computed(() =>
    userFiles.value.filter((file: UserFile) => file.isModified)
  )
  const loadedFiles = computed(() =>
    userFiles.value.filter((file: UserFile) => file.isLoaded)
  )

  const fileTree = computed<TreeExplorerNode<UserFile>>(() =>
    buildTree<UserFile>(userFiles.value, (userFile: UserFile) =>
      userFile.path.split('/')
    )
  )

  /**
   * Syncs the files in the given directory with the API.
   * @param dir The directory to sync.
   */
  const syncFiles = async (dir: string = '') => {
    const scope = currentUserFileScope()
    await syncEntities(
      dir,
      userFilesByPath.value,
      (file) =>
        new UserFile(
          file.path,
          file.modified,
          file.size,
          receivedUserFileIdentity(file.id, scope)
        ),
      (existingFile, file) => {
        const identity = receivedUserFileIdentity(file.id, scope)
        if (existingFile.savedFileIdentity && !identity) return
        if (
          !sameUserFileIdentity(existingFile.savedFileIdentity, identity) &&
          (existingFile.savedFileIdentity || identity)
        ) {
          if (existingFile.isLoaded || existingFile.isModified) return
          existingFile.savedFileIdentity = identity
        }
        if (existingFile.isModified) return
        existingFile.lastModified = file.modified
        existingFile.size = file.size
        existingFile.unload()
      },
      undefined,
      (file) => !file.savedFileIdentity || (!file.isModified && !file.isLoaded),
      () =>
        scope === null
          ? currentUserFileScope() === null
          : sameUserFileScope(scope, currentUserFileScope())
    )
  }

  return {
    userFiles,
    modifiedFiles,
    loadedFiles,
    fileTree,
    syncFiles
  }
})
