import { defineStore } from 'pinia'
import { api } from '@/scripts/api'
import { TreeNode } from 'primevue/treenode'
import { defaultGraph } from '@/scripts/defaultGraph'

export const useUserFileStore = defineStore('userFile', {
  state: () => ({
    files: [] as string[]
  }),
  getters: {
    workflowsTree(): TreeNode {
      const rootPath = 'workflows'
      const root: TreeNode = {
        key: rootPath,
        label: 'workflows',
        isDirectory: true,
        leaf: false,
        children: []
      }

      for (const filePath of this.files) {
        const parts = filePath.split('/')
        let current = root
        let key = rootPath

        for (let i = 0; i < parts.length; i++) {
          const part = parts[i]
          key += `/${part}`
          const isLastPart = i === parts.length - 1
          const isDirectory = !isLastPart || !filePath.includes('.')

          let next = current.children.find((child) => child.label === part)
          if (!next) {
            next = {
              key,
              label: part,
              isDirectory,
              leaf: !isDirectory,
              children: isDirectory ? [] : undefined
            }
            current.children.push(next)
          }
          current = next
        }
      }

      return root
    }
  },
  actions: {
    async loadFiles(dir: string = 'workflows') {
      this.files = (await api.listUserData(dir, true, false)).map(
        (filePath: string) => filePath.replaceAll('\\', '/')
      )
    },
    async renameFile(oldPath: string, newPath: string) {
      const resp = await api.moveUserData(oldPath, newPath)
      if (resp.status !== 200) {
        return { success: false, message: resp.statusText }
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
      await this.loadFiles()
      return { success: true }
    },
    async moveFile(sourcePath: string, destPath: string) {
      await api.moveUserData(sourcePath, destPath)
      await this.loadFiles()
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
