import { defineStore } from 'pinia'
import { api } from '@/scripts/api'
import type { TreeNode } from 'primevue/treenode'
import { buildTree } from '@/utils/treeUtil'

interface OpenFile {
  path: string
  content: string
  isModified: boolean
  originalContent: string
}

interface StoreState {
  files: string[]
  openFiles: OpenFile[]
}

interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
}

export const useUserFileStore = defineStore('userFile', {
  state: (): StoreState => ({
    files: [],
    openFiles: []
  }),

  getters: {
    getOpenFile: (state) => (path: string) =>
      state.openFiles.find((file) => file.path === path),
    modifiedFiles: (state) => state.openFiles.filter((file) => file.isModified),
    workflowsTree: (state): TreeNode =>
      buildTree(state.files, (path: string) => path.split('/'))
  },

  actions: {
    async openFile(path: string): Promise<void> {
      if (this.getOpenFile(path)) return

      const { success, data } = await this.getFileData(path)
      if (success && data) {
        this.openFiles.push({
          path,
          content: data,
          isModified: false,
          originalContent: data
        })
      }
    },

    closeFile(path: string): void {
      const index = this.openFiles.findIndex((file) => file.path === path)
      if (index !== -1) {
        this.openFiles.splice(index, 1)
      }
    },

    updateFileContent(path: string, newContent: string): void {
      const file = this.getOpenFile(path)
      if (file) {
        file.content = newContent
        file.isModified = file.content !== file.originalContent
      }
    },

    async saveOpenFile(path: string): Promise<ApiResponse> {
      const file = this.getOpenFile(path)
      if (file?.isModified) {
        const result = await this.saveFile(path, file.content)
        if (result.success) {
          file.isModified = false
          file.originalContent = file.content
        }
        return result
      }
      return { success: true }
    },

    discardChanges(path: string): void {
      const file = this.getOpenFile(path)
      if (file) {
        file.content = file.originalContent
        file.isModified = false
      }
    },

    async loadFiles(dir: string = './'): Promise<void> {
      this.files = (await api.listUserData(dir, true, false)).map(
        (filePath: string) => filePath.replaceAll('\\', '/')
      )

      this.openFiles = (
        await Promise.all(
          this.openFiles.map(async (openFile) => {
            if (!this.files.includes(openFile.path)) return null

            const { success, data } = await this.getFileData(openFile.path)
            if (success && data !== openFile.originalContent) {
              return {
                ...openFile,
                content: data,
                originalContent: data,
                isModified: openFile.content !== data
              }
            }

            return openFile
          })
        )
      ).filter((file): file is OpenFile => file !== null)
    },

    async renameFile(oldPath: string, newPath: string): Promise<ApiResponse> {
      const resp = await api.moveUserData(oldPath, newPath)
      if (resp.status !== 200) {
        return { success: false, message: resp.statusText }
      }

      const openFile = this.openFiles.find((file) => file.path === oldPath)
      if (openFile) {
        openFile.path = newPath
      }

      await this.loadFiles()
      return { success: true }
    },

    async deleteFile(path: string): Promise<ApiResponse> {
      const resp = await api.deleteUserData(path)
      if (resp.status !== 204) {
        return {
          success: false,
          message: `Error removing user data file '${path}': ${resp.status} ${resp.statusText}`
        }
      }

      const index = this.openFiles.findIndex((file) => file.path === path)
      if (index !== -1) {
        this.openFiles.splice(index, 1)
      }

      await this.loadFiles()
      return { success: true }
    },

    async saveFile(path: string, data: string): Promise<ApiResponse> {
      const resp = await api.storeUserData(path, data, {
        stringify: false,
        throwOnError: false,
        overwrite: true
      })
      if (resp.status !== 200) {
        return {
          success: false,
          message: `Error saving user data file '${path}': ${resp.status} ${resp.statusText}`
        }
      }

      await this.loadFiles()
      return { success: true }
    },

    async getFileData(path: string): Promise<ApiResponse<string>> {
      const resp = await api.getUserData(path)
      if (resp.status !== 200) {
        return { success: false, message: resp.statusText }
      }
      return { success: true, data: await resp.json() }
    }
  }
})
