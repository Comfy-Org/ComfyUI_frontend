import { setActivePinia, createPinia } from 'pinia'
import {
  ComfyWorkflow,
  LoadedComfyWorkflow,
  useWorkflowBookmarkStore,
  useWorkflowStore
} from '@/stores/workflowStore'
import { api } from '@/scripts/api'

// Add mock for api at the top of the file
jest.mock('@/scripts/api', () => ({
  api: {
    getUserData: jest.fn(),
    storeUserData: jest.fn()
  }
}))

describe('useWorkflowStore', () => {
  let store: ReturnType<typeof useWorkflowStore>
  let bookmarkStore: ReturnType<typeof useWorkflowBookmarkStore>

  const openTemporaryWorkflows = async (filenames: string[]) => {
    const workflows: ComfyWorkflow[] = []
    for (const filename of filenames) {
      const workflow = store.createTemporary(filename)
      await store.openWorkflow(workflow)
      workflows.push(workflow)
    }
    return workflows
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWorkflowStore()
    bookmarkStore = useWorkflowBookmarkStore()
    jest.clearAllMocks()

    // Add default mock implementations
    ;(api.getUserData as jest.Mock).mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ favorites: [] })
    })
    ;(api.storeUserData as jest.Mock).mockResolvedValue({
      status: 200
    })
  })

  describe('openWorkflow', () => {
    it('should load and open a workflow', async () => {
      // Create a test workflow
      const workflow = store.createTemporary('test.json')
      const mockWorkflowData = { nodes: [], links: [] }

      // Mock the load response
      jest.spyOn(workflow, 'load').mockImplementation(async () => {
        workflow.changeTracker = { activeState: mockWorkflowData } as any
        return workflow as LoadedComfyWorkflow
      })

      // Open the workflow
      await store.openWorkflow(workflow)

      // Verify the workflow is now active
      expect(store.activeWorkflow?.path).toBe(workflow.path)

      // Verify the workflow is in the open workflows list
      expect(
        store.openWorkflows.find((w) => w.path === workflow.path)
      ).not.toBeUndefined()
    })

    it('should not reload an already active workflow', async () => {
      const workflow = await store.createTemporary('test.json').load()
      jest.spyOn(workflow, 'load')

      // Set as active workflow
      store.activeWorkflow = workflow

      await store.openWorkflow(workflow)

      // Verify load was not called
      expect(workflow.load).not.toHaveBeenCalled()
    })
  })

  describe('renameWorkflow', () => {
    it('should rename workflow and update bookmarks', async () => {
      const workflow = store.createTemporary('dir/test.json')

      // Set up initial bookmark
      expect(workflow.path).toBe('workflows/dir/test.json')
      bookmarkStore.setBookmarked(workflow.path, true)
      expect(bookmarkStore.isBookmarked(workflow.path)).toBe(true)

      // Mock super.rename
      jest
        .spyOn(Object.getPrototypeOf(workflow), 'rename')
        .mockImplementation(async function (this: any, newPath: string) {
          this.path = newPath
          return this
        } as any)

      // Perform rename
      const newName = 'renamed.json'
      await store.renameWorkflow(workflow, newName)

      // Check that bookmark was transferred
      expect(bookmarkStore.isBookmarked(newName)).toBe(true)
      expect(bookmarkStore.isBookmarked('workflows/dir/test.json')).toBe(false)
    })

    it('should rename workflow without affecting bookmarks if not bookmarked', async () => {
      const workflow = store.createTemporary('test.json')

      // Verify not bookmarked initially
      expect(bookmarkStore.isBookmarked(workflow.path)).toBe(false)

      // Mock super.rename
      jest
        .spyOn(Object.getPrototypeOf(workflow), 'rename')
        .mockImplementation(async function (this: any, newPath: string) {
          this.path = newPath
          return this
        } as any)

      // Perform rename
      const newName = 'renamed'
      await workflow.rename(newName)

      // Check that no bookmarks were affected
      expect(bookmarkStore.isBookmarked(workflow.path)).toBe(false)
      expect(bookmarkStore.isBookmarked('test.json')).toBe(false)
    })
  })

  describe('deleteWorkflow', () => {
    it('should close and delete an open workflow', async () => {
      const workflow = store.createTemporary('test.json')

      // Mock the necessary methods
      jest.spyOn(workflow, 'delete').mockResolvedValue()

      // Open the workflow first
      await store.openWorkflow(workflow)
      expect(store.isOpen(workflow)).toBe(true)

      // Delete the workflow
      await store.deleteWorkflow(workflow)

      // Verify workflow was closed and deleted
      expect(workflow.delete).toHaveBeenCalled()
      expect(store.isOpen(workflow)).toBe(false)
    })

    it('should remove bookmark when deleting a bookmarked workflow', async () => {
      const workflow = store.createTemporary('test.json')

      // Mock delete method
      jest.spyOn(workflow, 'delete').mockResolvedValue()

      // Bookmark the workflow
      bookmarkStore.setBookmarked(workflow.path, true)
      expect(bookmarkStore.isBookmarked(workflow.path)).toBe(true)

      // Delete the workflow
      await store.deleteWorkflow(workflow)

      // Verify bookmark was removed
      expect(bookmarkStore.isBookmarked(workflow.path)).toBe(false)
    })
  })
})
