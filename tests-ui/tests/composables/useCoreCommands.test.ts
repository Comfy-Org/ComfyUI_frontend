import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCoreCommands } from '@/composables/useCoreCommands'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useSettingStore } from '@/stores/settingStore'

vi.mock('@/scripts/app', () => ({
  app: {
    clean: vi.fn(),
    canvas: {
      subgraph: null
    },
    graph: {
      clear: vi.fn()
    }
  }
}))

vi.mock('@/scripts/api', () => ({
  api: {
    dispatchCustomEvent: vi.fn(),
    apiURL: vi.fn(() => 'http://localhost:8188')
  }
}))

vi.mock('@/stores/settingStore')

vi.mock('@/stores/firebaseAuthStore', () => ({
  useFirebaseAuthStore: vi.fn(() => ({}))
}))

vi.mock('@/composables/auth/useFirebaseAuth', () => ({
  useFirebaseAuth: vi.fn(() => null)
}))

vi.mock('firebase/auth', () => ({
  setPersistence: vi.fn(),
  browserLocalPersistence: {},
  onAuthStateChanged: vi.fn()
}))

vi.mock('@/services/workflowService', () => ({
  useWorkflowService: vi.fn(() => ({}))
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: vi.fn(() => ({}))
}))

vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: vi.fn(() => ({}))
}))

vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: vi.fn(() => ({}))
}))

vi.mock('@/stores/toastStore', () => ({
  useToastStore: vi.fn(() => ({}))
}))

vi.mock('@/stores/workflowStore', () => ({
  useWorkflowStore: vi.fn(() => ({}))
}))

vi.mock('@/stores/workspace/colorPaletteStore', () => ({
  useColorPaletteStore: vi.fn(() => ({}))
}))

vi.mock('@/composables/auth/useFirebaseAuthActions', () => ({
  useFirebaseAuthActions: vi.fn(() => ({}))
}))

describe('useCoreCommands', () => {
  const mockSubgraph = {
    nodes: [
      // Mock input node
      {
        constructor: { comfyClass: 'SubgraphInputNode' },
        id: 'input1'
      },
      // Mock output node
      {
        constructor: { comfyClass: 'SubgraphOutputNode' },
        id: 'output1'
      },
      // Mock user node
      {
        constructor: { comfyClass: 'SomeUserNode' },
        id: 'user1'
      },
      // Another mock user node
      {
        constructor: { comfyClass: 'AnotherUserNode' },
        id: 'user2'
      }
    ],
    remove: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Set up Pinia
    setActivePinia(createPinia())

    // Reset app state
    app.canvas.subgraph = undefined

    // Mock settings store
    vi.mocked(useSettingStore).mockReturnValue({
      get: vi.fn().mockReturnValue(false) // Skip confirmation dialog
    } as any)

    // Mock global confirm
    global.confirm = vi.fn().mockReturnValue(true)
  })

  describe('ClearWorkflow command', () => {
    it('should clear main graph when not in subgraph', async () => {
      const commands = useCoreCommands()
      const clearCommand = commands.find(
        (cmd) => cmd.id === 'Comfy.ClearWorkflow'
      )!

      // Execute the command
      await clearCommand.function()

      expect(app.clean).toHaveBeenCalled()
      expect(app.graph.clear).toHaveBeenCalled()
      expect(api.dispatchCustomEvent).toHaveBeenCalledWith('graphCleared')
    })

    it('should preserve input/output nodes when clearing subgraph', async () => {
      // Set up subgraph context
      app.canvas.subgraph = mockSubgraph as any

      const commands = useCoreCommands()
      const clearCommand = commands.find(
        (cmd) => cmd.id === 'Comfy.ClearWorkflow'
      )!

      // Execute the command
      await clearCommand.function()

      expect(app.clean).toHaveBeenCalled()
      expect(app.graph.clear).not.toHaveBeenCalled()

      // Should only remove user nodes, not input/output nodes
      expect(mockSubgraph.remove).toHaveBeenCalledTimes(2)
      expect(mockSubgraph.remove).toHaveBeenCalledWith(mockSubgraph.nodes[2]) // user1
      expect(mockSubgraph.remove).toHaveBeenCalledWith(mockSubgraph.nodes[3]) // user2
      expect(mockSubgraph.remove).not.toHaveBeenCalledWith(
        mockSubgraph.nodes[0]
      ) // input1
      expect(mockSubgraph.remove).not.toHaveBeenCalledWith(
        mockSubgraph.nodes[1]
      ) // output1

      expect(api.dispatchCustomEvent).toHaveBeenCalledWith('graphCleared')
    })

    it('should respect confirmation setting', async () => {
      // Mock confirmation required
      vi.mocked(useSettingStore).mockReturnValue({
        get: vi.fn().mockReturnValue(true) // Require confirmation
      } as any)

      global.confirm = vi.fn().mockReturnValue(false) // User cancels

      const commands = useCoreCommands()
      const clearCommand = commands.find(
        (cmd) => cmd.id === 'Comfy.ClearWorkflow'
      )!

      // Execute the command
      await clearCommand.function()

      // Should not clear anything when user cancels
      expect(app.clean).not.toHaveBeenCalled()
      expect(app.graph.clear).not.toHaveBeenCalled()
      expect(api.dispatchCustomEvent).not.toHaveBeenCalled()
    })
  })
})
