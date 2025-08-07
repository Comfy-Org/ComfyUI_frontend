import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCoreCommands } from '@/composables/useCoreCommands'
import { useCanvasStore } from '@/stores/graphStore'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'

// Mock the stores
vi.mock('@/stores/graphStore')
vi.mock('@/stores/subgraphNavigationStore')

// Mock other dependencies
vi.mock('@/scripts/app', () => ({
  app: {}
}))

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: vi.fn(() => 'http://localhost:8188')
  }
}))

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

describe('useCoreCommands - ExitSubgraph', () => {
  let mockCanvas: any
  let mockSetGraph: ReturnType<typeof vi.fn>
  let mockGetCanvas: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())

    // Mock canvas and its methods
    mockSetGraph = vi.fn()
    mockCanvas = {
      graph: {
        rootGraph: { id: 'root-graph' }
      },
      setGraph: mockSetGraph
    }

    mockGetCanvas = vi.fn(() => mockCanvas)

    // Mock canvasStore
    vi.mocked(useCanvasStore).mockReturnValue({
      getCanvas: mockGetCanvas
    } as any)
  })

  it('should exit to parent subgraph when navigation stack has multiple items', () => {
    // Mock navigation stack with multiple subgraphs
    const parentSubgraph = { id: 'parent-subgraph' }
    const currentSubgraph = { id: 'current-subgraph' }

    vi.mocked(useSubgraphNavigationStore).mockReturnValue({
      navigationStack: [parentSubgraph, currentSubgraph]
    } as any)

    const commands = useCoreCommands()
    const exitSubgraphCommand = commands.find(
      (cmd) => cmd.id === 'Comfy.Graph.ExitSubgraph'
    )!

    // Execute the command
    void exitSubgraphCommand.function()

    expect(mockGetCanvas).toHaveBeenCalled()
    expect(mockSetGraph).toHaveBeenCalledWith(parentSubgraph)
  })

  it('should exit to root graph when navigation stack has only current subgraph', () => {
    // Mock navigation stack with only current subgraph
    const currentSubgraph = { id: 'current-subgraph' }

    vi.mocked(useSubgraphNavigationStore).mockReturnValue({
      navigationStack: [currentSubgraph]
    } as any)

    const commands = useCoreCommands()
    const exitSubgraphCommand = commands.find(
      (cmd) => cmd.id === 'Comfy.Graph.ExitSubgraph'
    )!

    // Execute the command
    void exitSubgraphCommand.function()

    expect(mockGetCanvas).toHaveBeenCalled()
    expect(mockSetGraph).toHaveBeenCalledWith(mockCanvas.graph.rootGraph)
  })

  it('should do nothing when canvas.graph is null', () => {
    // Mock canvas with null graph
    mockCanvas.graph = null

    const commands = useCoreCommands()
    const exitSubgraphCommand = commands.find(
      (cmd) => cmd.id === 'Comfy.Graph.ExitSubgraph'
    )!

    // Execute the command
    void exitSubgraphCommand.function()

    expect(mockGetCanvas).toHaveBeenCalled()
    expect(mockSetGraph).not.toHaveBeenCalled()
  })

  it('should have correct metadata', () => {
    const commands = useCoreCommands()
    const exitSubgraphCommand = commands.find(
      (cmd) => cmd.id === 'Comfy.Graph.ExitSubgraph'
    )!

    expect(exitSubgraphCommand).toBeDefined()
    expect(exitSubgraphCommand.icon).toBe('pi pi-arrow-up')
    expect(exitSubgraphCommand.label).toBe('Exit Subgraph')
    expect(exitSubgraphCommand.versionAdded).toBe('1.20.1')
  })
})
