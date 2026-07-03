import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'
import { UserFile, useUserFileStore } from '@/stores/userFileStore'

// Mock the api
vi.mock('@/scripts/api', () => ({
  api: {
    listUserDataFullInfo: vi.fn(),
    getUserData: vi.fn(),
    storeUserData: vi.fn(),
    deleteUserData: vi.fn(),
    moveUserData: vi.fn()
  }
}))

describe('useUserFileStore', () => {
  let store: ReturnType<typeof useUserFileStore>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useUserFileStore()
    vi.resetAllMocks()
  })

  it('should initialize with empty files', () => {
    expect(store.userFiles).toHaveLength(0)
    expect(store.modifiedFiles).toHaveLength(0)
    expect(store.loadedFiles).toHaveLength(0)
  })

  describe('syncFiles', () => {
    it('should add new files', async () => {
      const mockFiles = [
        { path: 'file1.txt', modified: 123, size: 100 },
        { path: 'file2.txt', modified: 456, size: 200 }
      ]
      vi.mocked(api.listUserDataFullInfo).mockResolvedValue(mockFiles)

      await store.syncFiles('dir')

      expect(store.userFiles).toHaveLength(2)
      expect(store.userFiles[0].path).toBe('dir/file1.txt')
      expect(store.userFiles[1].path).toBe('dir/file2.txt')
    })

    it('should update existing files', async () => {
      const initialFile = { path: 'file1.txt', modified: 123, size: 100 }
      vi.mocked(api.listUserDataFullInfo).mockResolvedValue([initialFile])
      await store.syncFiles('dir')

      const updatedFile = { path: 'file1.txt', modified: 456, size: 200 }
      vi.mocked(api.listUserDataFullInfo).mockResolvedValue([updatedFile])
      await store.syncFiles('dir')

      expect(store.userFiles).toHaveLength(1)
      expect(store.userFiles[0].lastModified).toBe(456)
      expect(store.userFiles[0].size).toBe(200)
    })

    it('should remove non-existent files', async () => {
      const initialFiles = [
        { path: 'file1.txt', modified: 123, size: 100 },
        { path: 'file2.txt', modified: 456, size: 200 }
      ]
      vi.mocked(api.listUserDataFullInfo).mockResolvedValue(initialFiles)
      await store.syncFiles('dir')

      const updatedFiles = [{ path: 'file1.txt', modified: 123, size: 100 }]
      vi.mocked(api.listUserDataFullInfo).mockResolvedValue(updatedFiles)
      await store.syncFiles('dir')

      expect(store.userFiles).toHaveLength(1)
      expect(store.userFiles[0].path).toBe('dir/file1.txt')
    })

    it('should sync root directory when no directory is specified', async () => {
      const mockFiles = [{ path: 'file1.txt', modified: 123, size: 100 }]
      vi.mocked(api.listUserDataFullInfo).mockResolvedValue(mockFiles)

      await store.syncFiles()

      expect(api.listUserDataFullInfo).toHaveBeenCalledWith('')
      expect(store.userFiles).toHaveLength(1)
      expect(store.userFiles[0].path).toBe('file1.txt')
    })
  })

  describe('UserFile', () => {
    describe('load', () => {
      it('should load file content', async () => {
        const file = new UserFile('file1.txt', 123, 100)
        vi.mocked(api.getUserData).mockResolvedValue(
          new Response('file content', { status: 200 })
        )

        await file.load()

        expect(file.content).toBe('file content')
        expect(file.originalContent).toBe('file content')
        expect(file.isLoading).toBe(false)
        expect(file.isLoaded).toBe(true)
      })

      it('should throw error on failed load', async () => {
        const file = new UserFile('file1.txt', 123, 100)
        vi.mocked(api.getUserData).mockResolvedValue(
          new Response(null, { status: 404, statusText: 'Not Found' })
        )

        await expect(file.load()).rejects.toThrow(
          "Failed to load file 'file1.txt': 404 Not Found"
        )
      })

      it('should skip loading temporary and already loaded files', async () => {
        const temporaryFile = UserFile.createTemporary('draft.txt')
        const loadedFile = new UserFile('file1.txt', 123, 100)
        loadedFile.content = 'content'
        loadedFile.originalContent = 'content'

        await temporaryFile.load()
        await loadedFile.load()

        expect(api.getUserData).not.toHaveBeenCalled()
      })

      it('should force reload loaded files', async () => {
        const file = new UserFile('file1.txt', 123, 100)
        file.content = 'old'
        file.originalContent = 'old'
        vi.mocked(api.getUserData).mockResolvedValue(
          new Response('new', { status: 200 })
        )

        await file.load({ force: true })

        expect(api.getUserData).toHaveBeenCalledWith('file1.txt')
        expect(file.content).toBe('new')
      })
    })

    describe('save', () => {
      it('should save modified file', async () => {
        const file = new UserFile('file1.txt', 123, 100)
        file.content = 'modified content'
        file.originalContent = 'original content'
        vi.mocked(api.storeUserData).mockResolvedValue(
          Response.json({ modified: 456, size: 200 }, { status: 200 })
        )

        await file.save()

        expect(api.storeUserData).toHaveBeenCalledWith(
          'file1.txt',
          'modified content',
          { throwOnError: true, full_info: true, overwrite: true }
        )
        expect(file.lastModified).toBe(456)
        expect(file.size).toBe(200)
      })

      it('should not save unmodified file', async () => {
        const file = new UserFile('file1.txt', 123, 100)
        file.content = 'content'
        file.originalContent = 'content'

        await file.save()

        expect(api.storeUserData).not.toHaveBeenCalled()
      })

      it('should save unmodified files when forced', async () => {
        const file = new UserFile('file1.txt', 123, 100)
        file.content = 'content'
        file.originalContent = 'content'
        vi.mocked(api.storeUserData).mockResolvedValue(
          Response.json('file1.txt', { status: 200 })
        )

        await file.save({ force: true })

        expect(api.storeUserData).toHaveBeenCalledWith('file1.txt', 'content', {
          throwOnError: true,
          full_info: true,
          overwrite: true
        })
        expect(file.lastModified).toBe(123)
        expect(file.size).toBe(100)
      })

      it('should normalize string modified times', async () => {
        const file = new UserFile('file1.txt', 123, 100)
        file.content = 'modified content'
        file.originalContent = 'original content'
        vi.mocked(api.storeUserData).mockResolvedValue(
          Response.json(
            { modified: '2024-01-02T03:04:05Z', size: 200 },
            { status: 200 }
          )
        )

        await file.save()

        expect(file.lastModified).toBe(
          new Date('2024-01-02T03:04:05Z').getTime()
        )
        expect(file.size).toBe(200)
      })

      it('should fall back when modified time is invalid', async () => {
        const dateNow = vi.spyOn(Date, 'now').mockReturnValue(999)
        const file = new UserFile('file1.txt', 123, 100)
        file.content = 'modified content'
        file.originalContent = 'original content'
        vi.mocked(api.storeUserData).mockResolvedValue(
          Response.json({ modified: 'bad date', size: 200 }, { status: 200 })
        )

        await file.save()

        expect(file.lastModified).toBe(999)
        dateNow.mockRestore()
      })
    })

    describe('delete', () => {
      it('should delete file', async () => {
        const file = new UserFile('file1.txt', 123, 100)
        vi.mocked(api.deleteUserData).mockResolvedValue(
          new Response(null, { status: 204 })
        )

        await file.delete()

        expect(api.deleteUserData).toHaveBeenCalledWith('file1.txt')
      })

      it('should skip deleting temporary files', async () => {
        const file = UserFile.createTemporary('draft.txt')

        await file.delete()

        expect(api.deleteUserData).not.toHaveBeenCalled()
      })

      it('should throw when delete fails', async () => {
        const file = new UserFile('file1.txt', 123, 100)
        vi.mocked(api.deleteUserData).mockResolvedValue(
          new Response(null, { status: 500, statusText: 'Server Error' })
        )

        await expect(file.delete()).rejects.toThrow(
          "Failed to delete file 'file1.txt': 500 Server Error"
        )
      })
    })

    describe('rename', () => {
      it('should rename file', async () => {
        const file = new UserFile('file1.txt', 123, 100)
        vi.mocked(api.moveUserData).mockResolvedValue(
          Response.json({ modified: 456, size: 200 }, { status: 200 })
        )

        await file.rename('newfile.txt')

        expect(api.moveUserData).toHaveBeenCalledWith(
          'file1.txt',
          'newfile.txt'
        )
        expect(file.path).toBe('newfile.txt')
        expect(file.lastModified).toBe(456)
        expect(file.size).toBe(200)
      })

      it('should rename temporary files locally', async () => {
        const file = UserFile.createTemporary('draft.txt')

        await file.rename('renamed.txt')

        expect(api.moveUserData).not.toHaveBeenCalled()
        expect(file.path).toBe('renamed.txt')
      })

      it('should throw when rename fails', async () => {
        const file = new UserFile('file1.txt', 123, 100)
        vi.mocked(api.moveUserData).mockResolvedValue(
          new Response(null, { status: 409, statusText: 'Conflict' })
        )

        await expect(file.rename('newfile.txt')).rejects.toThrow(
          "Failed to rename file 'file1.txt': 409 Conflict"
        )
      })

      it('should leave metadata unchanged when rename returns a string', async () => {
        const file = new UserFile('file1.txt', 123, 100)
        vi.mocked(api.moveUserData).mockResolvedValue(
          Response.json('newfile.txt', { status: 200 })
        )

        await file.rename('newfile.txt')

        expect(file.path).toBe('newfile.txt')
        expect(file.lastModified).toBe(123)
        expect(file.size).toBe(100)
      })
    })

    describe('saveAs', () => {
      it('should save file with new path', async () => {
        const file = new UserFile('file1.txt', 123, 100)
        file.content = 'file content'
        vi.mocked(api.storeUserData).mockResolvedValue(
          Response.json({ modified: 456, size: 200 }, { status: 200 })
        )

        const newFile = await file.saveAs('newfile.txt')

        expect(api.storeUserData).toHaveBeenCalledWith(
          'newfile.txt',
          'file content',
          { throwOnError: true, full_info: true, overwrite: false }
        )
        expect(newFile).toBeInstanceOf(UserFile)
        expect(newFile.path).toBe('newfile.txt')
        expect(newFile.lastModified).toBe(456)
        expect(newFile.size).toBe(200)
        expect(newFile.content).toBe('file content')
      })

      it('should save temporary files in place', async () => {
        const file = UserFile.createTemporary('draft.txt')
        file.content = 'file content'
        vi.mocked(api.storeUserData).mockResolvedValue(
          Response.json({ modified: 456, size: 200 }, { status: 200 })
        )

        const newFile = await file.saveAs('newfile.txt')

        expect(api.storeUserData).toHaveBeenCalledWith(
          'draft.txt',
          'file content',
          { throwOnError: true, full_info: true, overwrite: false }
        )
        expect(newFile).toBe(file)
        expect(newFile.path).toBe('draft.txt')
      })
    })
  })
})
