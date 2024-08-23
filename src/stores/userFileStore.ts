import { defineStore } from 'pinia'
import { api } from '@/scripts/api'
import { TreeNode } from 'primevue/treenode'
import { defaultGraph } from '@/scripts/defaultGraph'
import { buildTree } from '@/utils/treeUtil'

export interface OpenFile {
  path: string
  content: string
  isModified: boolean
  originalContent: string
}

export const useUserFileStore = defineStore('userFile', {
  state: () => ({
    files: [] as string[],
    openFiles: [] as OpenFile[]
  }),
  getters: {
    getOpenFile: (state) => (path: string) => {
      return state.openFiles.find((file) => file.path === path)
    },
    modifiedFiles: (state) => {
      return state.openFiles.filter((file) => file.isModified)
    },
    workflowsTree(state): TreeNode {
      return buildTree(state.files, (path: string) => path.split('/'))
    }
  },
  actions: {
    async openFile(path: string) {
      if (this.getOpenFile(path)) return

      const { success, data } = await this.getFileData(path)
      if (success) {
        this.openFiles.push({
          path,
          content: data,
          isModified: false,
          originalContent: data
        })
      }
    },
    closeFile(path: string) {
      const index = this.openFiles.findIndex(
        (file: OpenFile) => file.path === path
      )
      if (index !== -1) {
        this.openFiles.splice(index, 1)
      }
    },
    updateFileContent(path: string, newContent: string) {
      const file = this.getOpenFile(path)
      if (file) {
        file.content = newContent
        file.isModified = file.content !== file.originalContent
      }
    },
    async saveOpenFile(path: string) {
      const file = this.getOpenFile(path)
      console.error(file)
      if (file && file.isModified) {
        const result = await this.saveFile(path, file.content)
        console.error(result)
        if (result.success) {
          file.isModified = false
          file.originalContent = file.content
        }
        return result
      }
      return { success: true }
    },
    discardChanges(path: string) {
      const file = this.getOpenFile(path)
      if (file) {
        file.content = file.originalContent
        file.isModified = false
      }
    },
    async loadFiles(dir: string = 'workflows') {
      this.files = (
        await api.listUserData(dir, /* recurse=*/ true, /* split=*/ false)
      ).map((filePath: string) => filePath.replaceAll('\\', '/'))

      // Update openFiles to reflect changes in the file system
      this.openFiles = await Promise.all(
        this.openFiles.map(async (openFile) => {
          if (!this.files.includes(openFile.path)) {
            // File has been deleted from the file system
            return null
          }

          // Check if file content has changed
          const { success, data } = await this.getFileData(openFile.path)
          if (success && data !== openFile.originalContent) {
            // File has been modified in the file system
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

      // Remove null entries (deleted files)
      this.openFiles = this.openFiles.filter((file) => file !== null)
    },
    async renameFile(oldPath: string, newPath: string) {
      const resp = await api.moveUserData(oldPath, newPath)
      if (resp.status !== 200) {
        return { success: false, message: resp.statusText }
      }
      // Update openFiles state
      const openFile = this.openFiles.find(
        (file: OpenFile) => file.path === oldPath
      )
      if (openFile) {
        openFile.path = newPath
      }
      await this.loadFiles()
      return { success: true }
    },
    async deleteFile(path: string) {
      const resp = await api.deleteUserData(path)
      if (resp.status !== 204) {
        return {
          success: false,
          message: `Error removing user data file '${path}': ${resp.status} ${resp.statusText}`
        }
      }
      // Remove from openFiles if it's open
      const index = this.openFiles.findIndex(
        (file: OpenFile) => file.path === path
      )
      if (index !== -1) {
        this.openFiles.splice(index, 1)
      }
      await this.loadFiles()
      return { success: true }
    },
    async saveFile(path: string, data: string) {
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
    async createDefaultWorkflow(path: string) {
      return await this.saveFile(path, JSON.stringify(defaultGraph))
    },
    async getFileData(path: string) {
      const resp = await api.getUserData(path)
      if (resp.status !== 200) {
        return { success: false, message: resp.statusText }
      }
      return { success: true, data: await resp.json() }
    }
  }
})
