import { setActivePinia, createPinia } from 'pinia'
import { useUserFileStore } from '@/stores/userFileStore'
import { api } from '@/scripts/api'

// Mock the api
jest.mock('@/scripts/api', () => ({
  api: {
    listUserData: jest.fn(),
    moveUserData: jest.fn(),
    deleteUserData: jest.fn(),
    storeUserData: jest.fn(),
    getUserData: jest.fn()
  }
}))

describe('useUserFileStore', () => {
  let store: ReturnType<typeof useUserFileStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useUserFileStore()
  })

  it('should open a file', async () => {
    const mockFileData = { success: true, data: 'file content' }
    ;(api.getUserData as jest.Mock).mockResolvedValue({
      status: 200,
      json: () => mockFileData.data
    })

    await store.openFile('test.txt')

    expect(store.openFiles).toHaveLength(1)
    expect(store.openFiles[0]).toEqual({
      path: 'test.txt',
      content: 'file content',
      isModified: false,
      originalContent: 'file content'
    })
  })

  it('should close a file', () => {
    store.openFiles = [
      {
        path: 'test.txt',
        content: 'content',
        isModified: false,
        originalContent: 'content'
      }
    ]

    store.closeFile('test.txt')

    expect(store.openFiles).toHaveLength(0)
  })

  it('should update file content', () => {
    store.openFiles = [
      {
        path: 'test.txt',
        content: 'old content',
        isModified: false,
        originalContent: 'old content'
      }
    ]

    store.updateFileContent('test.txt', 'new content')

    expect(store.openFiles[0].content).toBe('new content')
    expect(store.openFiles[0].isModified).toBe(true)
  })

  it('should save an open file', async () => {
    store.openFiles = [
      {
        path: 'test.txt',
        content: 'modified content',
        isModified: true,
        originalContent: 'original content'
      }
    ]
    ;(api.storeUserData as jest.Mock).mockResolvedValue({ status: 200 })
    ;(api.listUserData as jest.Mock).mockResolvedValue(['test.txt'])
    ;(api.getUserData as jest.Mock).mockResolvedValue({
      status: 200,
      json: () => 'modified content'
    })

    await store.saveOpenFile('test.txt')

    expect(store.openFiles[0].isModified).toBe(false)
    expect(store.openFiles[0].originalContent).toBe('modified content')
  })

  it('should discard changes', () => {
    store.openFiles = [
      {
        path: 'test.txt',
        content: 'modified content',
        isModified: true,
        originalContent: 'original content'
      }
    ]

    store.discardChanges('test.txt')

    expect(store.openFiles[0].content).toBe('original content')
    expect(store.openFiles[0].isModified).toBe(false)
  })

  it('should load files', async () => {
    ;(api.listUserData as jest.Mock).mockResolvedValue([
      'file1.txt',
      'file2.txt'
    ])

    await store.loadFiles()

    expect(store.files).toEqual(['file1.txt', 'file2.txt'])
  })

  it('should rename a file', async () => {
    store.openFiles = [
      {
        path: 'oldfile.txt',
        content: 'content',
        isModified: false,
        originalContent: 'content'
      }
    ]
    ;(api.moveUserData as jest.Mock).mockResolvedValue({ status: 200 })
    ;(api.listUserData as jest.Mock).mockResolvedValue(['newfile.txt'])

    await store.renameFile('oldfile.txt', 'newfile.txt')

    expect(store.openFiles[0].path).toBe('newfile.txt')
    expect(store.files).toEqual(['newfile.txt'])
  })

  it('should delete a file', async () => {
    store.openFiles = [
      {
        path: 'file.txt',
        content: 'content',
        isModified: false,
        originalContent: 'content'
      }
    ]
    ;(api.deleteUserData as jest.Mock).mockResolvedValue({ status: 204 })
    ;(api.listUserData as jest.Mock).mockResolvedValue([])

    await store.deleteFile('file.txt')

    expect(store.openFiles).toHaveLength(0)
    expect(store.files).toEqual([])
  })

  it('should get file data', async () => {
    const mockFileData = { content: 'file content' }
    ;(api.getUserData as jest.Mock).mockResolvedValue({
      status: 200,
      json: () => mockFileData
    })

    const result = await store.getFileData('test.txt')

    expect(result).toEqual({ success: true, data: mockFileData })
  })
})
