// import { setActivePinia, createPinia } from 'pinia'
// import { UserFile, useUserFileStore } from '@/stores/userFileStore'
// import { api } from '@/scripts/api'

// // Mock the api
// jest.mock('@/scripts/api', () => ({
//   api: {
//     listUserDataFullInfo: jest.fn(),
//     getUserData: jest.fn(),
//     storeUserData: jest.fn(),
//     deleteUserData: jest.fn(),
//     moveUserData: jest.fn()
//   }
// }))

// describe('useUserFileStore', () => {
//   let store: ReturnType<typeof useUserFileStore>

//   beforeEach(() => {
//     setActivePinia(createPinia())
//     store = useUserFileStore()
//   })

//   it('should initialize with empty files', () => {
//     expect(store.userFiles).toHaveLength(0)
//     expect(store.modifiedFiles).toHaveLength(0)
//     expect(store.openedFiles).toHaveLength(0)
//   })

//   describe('syncFiles', () => {
//     it('should add new files', async () => {
//       const mockFiles = [
//         { path: 'file1.txt', modified: 123, size: 100 },
//         { path: 'file2.txt', modified: 456, size: 200 }
//       ]
//       ;(api.listUserDataFullInfo as jest.Mock).mockResolvedValue(mockFiles)

//       await store.syncFiles()

//       expect(store.userFiles).toHaveLength(2)
//       expect(store.userFiles[0].path).toBe('file1.txt')
//       expect(store.userFiles[1].path).toBe('file2.txt')
//     })

//     it('should update existing files', async () => {
//       const initialFile = { path: 'file1.txt', modified: 123, size: 100 }
//       ;(api.listUserDataFullInfo as jest.Mock).mockResolvedValue([initialFile])
//       await store.syncFiles()

//       const updatedFile = { path: 'file1.txt', modified: 456, size: 200 }
//       ;(api.listUserDataFullInfo as jest.Mock).mockResolvedValue([updatedFile])
//       await store.syncFiles()

//       expect(store.userFiles).toHaveLength(1)
//       expect(store.userFiles[0].lastModified).toBe(456)
//       expect(store.userFiles[0].size).toBe(200)
//     })

//     it('should remove non-existent files', async () => {
//       const initialFiles = [
//         { path: 'file1.txt', modified: 123, size: 100 },
//         { path: 'file2.txt', modified: 456, size: 200 }
//       ]
//       ;(api.listUserDataFullInfo as jest.Mock).mockResolvedValue(initialFiles)
//       await store.syncFiles()

//       const updatedFiles = [{ path: 'file1.txt', modified: 123, size: 100 }]
//       ;(api.listUserDataFullInfo as jest.Mock).mockResolvedValue(updatedFiles)
//       await store.syncFiles()

//       expect(store.userFiles).toHaveLength(1)
//       expect(store.userFiles[0].path).toBe('file1.txt')
//     })
//   })

//   describe('loadFile', () => {
//     it('should load file content', async () => {
//       const file = new UserFile('file1.txt', 123, 100)
//       ;(api.getUserData as jest.Mock).mockResolvedValue({
//         status: 200,
//         text: () => Promise.resolve('file content')
//       })

//       await store.loadFile(file)

//       expect(file.content).toBe('file content')
//       expect(file.originalContent).toBe('file content')
//       expect(file.isLoading).toBe(false)
//     })

//     it('should throw error on failed load', async () => {
//       const file = new UserFile('file1.txt', 123, 100)
//       ;(api.getUserData as jest.Mock).mockResolvedValue({
//         status: 404,
//         statusText: 'Not Found'
//       })

//       await expect(store.loadFile(file)).rejects.toThrow(
//         "Failed to load file 'file1.txt': 404 Not Found"
//       )
//     })
//   })

//   describe('saveFile', () => {
//     it('should save modified file', async () => {
//       const file = new UserFile('file1.txt', 123, 100)
//       file.content = 'modified content'
//       file.originalContent = 'original content'
//       ;(api.storeUserData as jest.Mock).mockResolvedValue({ status: 200 })
//       ;(api.listUserDataFullInfo as jest.Mock).mockResolvedValue([])

//       await store.saveFile(file)

//       expect(api.storeUserData).toHaveBeenCalledWith(
//         'file1.txt',
//         'modified content'
//       )
//     })

//     it('should not save unmodified file', async () => {
//       const file = new UserFile('file1.txt', 123, 100)
//       file.content = 'content'
//       file.originalContent = 'content'
//       ;(api.listUserDataFullInfo as jest.Mock).mockResolvedValue([])

//       await store.saveFile(file)

//       expect(api.storeUserData).not.toHaveBeenCalled()
//     })
//   })

//   describe('deleteFile', () => {
//     it('should delete file', async () => {
//       const file = new UserFile('file1.txt', 123, 100)
//       ;(api.deleteUserData as jest.Mock).mockResolvedValue({ status: 204 })
//       ;(api.listUserDataFullInfo as jest.Mock).mockResolvedValue([])

//       await store.deleteFile(file)

//       expect(api.deleteUserData).toHaveBeenCalledWith('file1.txt')
//     })
//   })

//   describe('renameFile', () => {
//     it('should rename file', async () => {
//       const file = new UserFile('file1.txt', 123, 100)
//       ;(api.moveUserData as jest.Mock).mockResolvedValue({ status: 200 })
//       ;(api.listUserDataFullInfo as jest.Mock).mockResolvedValue([])

//       await store.renameFile(file, 'newfile.txt')

//       expect(api.moveUserData).toHaveBeenCalledWith('file1.txt', 'newfile.txt')
//       expect(file.path).toBe('newfile.txt')
//     })
//   })
// })
