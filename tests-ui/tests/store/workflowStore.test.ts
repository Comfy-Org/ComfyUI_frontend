import { setActivePinia, createPinia } from 'pinia'
import { useWorkflowStore } from '@/stores/workflowStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

// Mock dependencies
jest.mock('@/scripts/api', () => ({
  api: {
    listUserDataFullInfo: jest.fn()
  }
}))
jest.mock('@/scripts/app', () => ({
  app: {
    loadGraphData: jest.fn()
  }
}))

describe('useWorkflowStore', () => {
  let store: ReturnType<typeof useWorkflowStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWorkflowStore()
    jest.clearAllMocks()
  })

  describe('openWorkflow', () => {
    it('should load and open a workflow', async () => {
      // Create a test workflow
      const workflow = store.createTemporary('test.json')
      const mockWorkflowData = { nodes: [], links: [] }

      // Mock the load response
      jest.spyOn(workflow, 'load').mockImplementation(async () => {
        workflow.changeTracker = { activeState: mockWorkflowData } as any
        return workflow
      })

      // Open the workflow
      await store.openWorkflow(workflow)

      // Verify the workflow was loaded
      expect(workflow.load).toHaveBeenCalled()

      // Verify the graph was loaded in the app
      expect(app.loadGraphData).toHaveBeenCalledWith(
        mockWorkflowData,
        true,
        true,
        workflow,
        {
          showMissingModelsDialog: true,
          showMissingNodesDialog: true
        }
      )

      // Verify the workflow is now active
      expect(store.activeWorkflow).toBe(workflow)

      // Verify the workflow is in the open workflows list
      expect(store.openWorkflows).toContain(workflow)
    })

    it('should not reload an already active workflow', async () => {
      const workflow = store.createTemporary('test.json')
      jest.spyOn(workflow, 'load')

      // Set as active workflow
      store.activeWorkflow = workflow

      await store.openWorkflow(workflow)

      // Verify load was not called
      expect(workflow.load).not.toHaveBeenCalled()
      expect(app.loadGraphData).not.toHaveBeenCalled()
    })
  })
})
