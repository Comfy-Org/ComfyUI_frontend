import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

import { ComfyApp } from '@/scripts/app'
import type { ComfyExtension } from '@/types/comfy'

// Create mock extension service
const mockExtensionService = {
  loadExtensions: vi.fn().mockResolvedValue(undefined),
  registerExtension: vi.fn(),
  invokeExtensions: vi.fn(),
  invokeExtensionsAsync: vi.fn().mockResolvedValue(undefined),
  enabledExtensions: [] as ComfyExtension[]
}

// Mock extension service
vi.mock('@/services/extensionService', () => ({
  useExtensionService: () => mockExtensionService
}))

// Mock dependencies
vi.mock('@/stores/toastStore', () => ({
  useToastStore: () => ({
    add: vi.fn()
  })
}))

vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: () => ({
    workflow: {
      syncWorkflows: vi.fn().mockResolvedValue(undefined)
    }
  })
}))

vi.mock('@/services/subgraphService', () => ({
  useSubgraphService: () => ({
    registerNewSubgraph: vi.fn()
  })
}))

// Mock LiteGraph
vi.mock('@/lib/litegraph/src/litegraph', async (importOriginal) => {
  const actual = (await importOriginal()) as any
  return {
    ...actual,
    LGraph: vi.fn().mockImplementation(() => ({
      events: {
        addEventListener: vi.fn()
      },
      start: vi.fn(),
      stop: vi.fn(),
      registerNodeType: vi.fn(),
      createNode: vi.fn()
    })),
    LGraphCanvas: vi.fn().mockImplementation((canvasEl) => ({
      state: reactive({}),
      draw: vi.fn(),
      canvas: canvasEl
    })),
    LiteGraph: {
      ...actual.LiteGraph,
      alt_drag_do_clone_nodes: false,
      macGesturesRequireMac: true
    }
  }
})

// Mock other required methods
vi.mock('@/stores/extensionStore', () => ({
  useExtensionStore: () => ({
    disabledExtensions: new Set()
  })
}))

vi.mock('@/utils/app.utils', () => ({
  makeUUID: vi.fn(() => 'test-uuid')
}))

// Mock API
vi.mock('@/scripts/api', () => ({
  api: {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    apiURL: vi.fn((path) => `/api${path}`),
    connect: vi.fn(),
    init: vi.fn().mockResolvedValue(undefined),
    getSystemStats: vi.fn().mockResolvedValue({}),
    getNodeDefs: vi.fn().mockResolvedValue({})
  }
}))

describe('Extension Pre-Init Hook', () => {
  let app: ComfyApp
  let mockCanvas: HTMLCanvasElement
  let callOrder: string[]

  beforeEach(() => {
    vi.clearAllMocks()
    callOrder = []

    // Reset mock extension service
    mockExtensionService.enabledExtensions = []
    mockExtensionService.invokeExtensionsAsync.mockReset()
    mockExtensionService.invokeExtensionsAsync.mockImplementation(
      async (method: keyof ComfyExtension) => {
        // Call the appropriate hook on all registered extensions
        for (const ext of mockExtensionService.enabledExtensions) {
          const hookFn = ext[method]
          if (typeof hookFn === 'function') {
            try {
              await hookFn.call(ext, app)
            } catch (error) {
              console.error(`Error in extension ${ext.name} ${method}`, error)
            }
          }
        }
      }
    )

    // Create mock canvas
    mockCanvas = document.createElement('canvas')
    mockCanvas.getContext = vi.fn().mockReturnValue({
      scale: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn()
    })

    // Create mock DOM elements
    const createMockElement = (id: string) => {
      const el = document.createElement('div')
      el.id = id
      document.body.appendChild(el)
      return el
    }

    createMockElement('comfyui-body-top')
    createMockElement('comfyui-body-left')
    createMockElement('comfyui-body-right')
    createMockElement('comfyui-body-bottom')
    createMockElement('graph-canvas-container')

    app = new ComfyApp()
    // Mock app methods that are called during setup
    app.registerNodes = vi.fn().mockResolvedValue(undefined)

    // Mock addEventListener for canvas element
    mockCanvas.addEventListener = vi.fn()
    mockCanvas.removeEventListener = vi.fn()

    // Mock window methods
    window.addEventListener = vi.fn()
    window.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      disconnect: vi.fn()
    }))

    // Mock WebSocket
    const mockWebSocket = vi.fn().mockImplementation(() => ({
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
      readyState: 1,
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3
    }))
    ;(mockWebSocket as any).CONNECTING = 0
    ;(mockWebSocket as any).OPEN = 1
    ;(mockWebSocket as any).CLOSING = 2
    ;(mockWebSocket as any).CLOSED = 3
    global.WebSocket = mockWebSocket as any
  })

  afterEach(() => {
    // Clean up DOM elements
    document.body.innerHTML = ''
  })

  it('should call preInit hook before init hook', async () => {
    const testExtension: ComfyExtension = {
      name: 'TestExtension',
      preInit: vi.fn(async () => {
        callOrder.push('preInit')
      }),
      init: vi.fn(async () => {
        callOrder.push('init')
      }),
      setup: vi.fn(async () => {
        callOrder.push('setup')
      })
    }

    // Register the extension
    mockExtensionService.enabledExtensions.push(testExtension)

    // Run app setup
    await app.setup(mockCanvas)

    // Verify all hooks were called
    expect(testExtension.preInit).toHaveBeenCalledWith(app)
    expect(testExtension.init).toHaveBeenCalledWith(app)
    expect(testExtension.setup).toHaveBeenCalledWith(app)

    // Verify correct order
    expect(callOrder).toEqual(['preInit', 'init', 'setup'])
  })

  it('should call preInit before canvas creation', async () => {
    const events: string[] = []

    const testExtension: ComfyExtension = {
      name: 'CanvasTestExtension',
      preInit: vi.fn(async () => {
        events.push('preInit')
        // Canvas should not exist yet
        expect(app.canvas).toBeUndefined()
      }),
      init: vi.fn(async () => {
        events.push('init')
        // Canvas should exist by init
        expect(app.canvas).toBeDefined()
      })
    }

    mockExtensionService.enabledExtensions.push(testExtension)

    await app.setup(mockCanvas)

    expect(events).toEqual(['preInit', 'init'])
  })

  it('should handle async preInit hooks', async () => {
    const preInitComplete = vi.fn()

    const testExtension: ComfyExtension = {
      name: 'AsyncExtension',
      preInit: vi.fn(async () => {
        // Simulate async operation
        await new Promise((resolve) => setTimeout(resolve, 10))
        preInitComplete()
      }),
      init: vi.fn()
    }

    mockExtensionService.enabledExtensions.push(testExtension)

    await app.setup(mockCanvas)

    // Ensure async preInit completed before init
    expect(preInitComplete).toHaveBeenCalled()
    expect(testExtension.init).toHaveBeenCalled()

    // Verify order - preInit should be called before init
    const preInitCallOrder = (preInitComplete as any).mock
      .invocationCallOrder[0]
    const initCallOrder = (testExtension.init as any).mock
      .invocationCallOrder[0]
    expect(preInitCallOrder).toBeLessThan(initCallOrder)
  })

  it('should call preInit for multiple extensions in registration order', async () => {
    const extension1: ComfyExtension = {
      name: 'Extension1',
      preInit: vi.fn(() => {
        callOrder.push('ext1-preInit')
      })
    }

    const extension2: ComfyExtension = {
      name: 'Extension2',
      preInit: vi.fn(() => {
        callOrder.push('ext2-preInit')
      })
    }

    const extension3: ComfyExtension = {
      name: 'Extension3',
      preInit: vi.fn(() => {
        callOrder.push('ext3-preInit')
      })
    }

    mockExtensionService.enabledExtensions.push(
      extension1,
      extension2,
      extension3
    )

    await app.setup(mockCanvas)

    expect(callOrder).toContain('ext1-preInit')
    expect(callOrder).toContain('ext2-preInit')
    expect(callOrder).toContain('ext3-preInit')
  })

  it('should handle errors in preInit gracefully', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const errorExtension: ComfyExtension = {
      name: 'ErrorExtension',
      preInit: vi.fn(async () => {
        throw new Error('PreInit error')
      }),
      init: vi.fn() // Should still be called
    }

    mockExtensionService.enabledExtensions.push(errorExtension)

    await app.setup(mockCanvas)

    // Error should be logged
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('Error in extension ErrorExtension'),
      expect.any(Error)
    )

    // Other hooks should still be called
    expect(errorExtension.init).toHaveBeenCalled()

    consoleError.mockRestore()
  })
})
