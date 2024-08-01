import { defineStore } from 'pinia'
import { api } from '@/scripts/api'
import { TreeNode } from 'primevue/treenode'

export const useWorkflowStore = defineStore('workflow', {
  state: () => ({
    files: [] as string[]
  }),
  getters: {
    fileTree(): TreeNode {
      const root: TreeNode = {
        key: 'root',
        label: 'Workflows',
        isDirectory: true,
        leaf: false,
        children: []
      }

      for (const filePath of this.files) {
        const parts = filePath.split('/')
        let current = root
        let key = 'root'

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
      await api.moveUserData(oldPath, newPath)
      await this.loadFiles()
    },
    async deleteFile(path: string) {
      await api.deleteUserData(path)
      await this.loadFiles()
    },
    async moveFile(sourcePath: string, destPath: string) {
      await api.moveUserData(sourcePath, destPath)
      await this.loadFiles()
    },
    async getFileData(path: string) {
      return await api.getUserData(path)
    }
  }
})
