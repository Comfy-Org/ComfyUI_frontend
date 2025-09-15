import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { useSubgraphNavigation } from '@/renderer/core/canvas/useSubgraphNavigation'

// Create mutable mock for app
const mockApp = {
  canvas: {
    graph: null as LGraph | null,
    subgraph: null as any
  }
}

vi.mock('@/scripts/app', () => ({
  app: mockApp
}))

vi.mock('@/stores/graphStore', () => ({
  useCanvasStore: () => ({
    canvas: {
      canvas: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }
    }
  })
}))

vi.mock('@vueuse/core', () => ({
  useEventListener: vi.fn(),
  whenever: vi.fn((_getter, callback) => {
    // Simulate immediate execution
    const canvas = {
      canvas: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }
    }
    callback(canvas)
  })
}))

describe('useSubgraphNavigation', () => {
  let mockEventListener: Mock
  let onSubgraphEnter: Mock
  let onSubgraphExit: Mock
  let onGraphChange: Mock

  beforeEach(async () => {
    vi.clearAllMocks()

    // Setup mock event listener
    mockEventListener = vi.fn()
    const { useEventListener } = await import('@vueuse/core')
    ;(useEventListener as Mock).mockImplementation((target, event, handler) => {
      mockEventListener(target, event, handler)
    })

    // Setup callback mocks
    onSubgraphEnter = vi.fn()
    onSubgraphExit = vi.fn()
    onGraphChange = vi.fn()
  })

  it('should call onSubgraphEnter when subgraph-opened event is fired', async () => {
    useSubgraphNavigation({
      onSubgraphEnter,
      onSubgraphExit,
      onGraphChange
    })

    // Find the subgraph-opened event listener
    const subgraphOpenedCall = mockEventListener.mock.calls.find(
      (call) => call[1] === 'subgraph-opened'
    )
    expect(subgraphOpenedCall).toBeDefined()
    if (!subgraphOpenedCall) throw new Error('Event listener not found')

    // Trigger the event handler
    const handler = subgraphOpenedCall[2]
    handler()

    expect(onSubgraphEnter).toHaveBeenCalledOnce()
    expect(onSubgraphExit).not.toHaveBeenCalled()
  })

  it('should call onSubgraphExit when exiting a subgraph via set-graph event', async () => {
    // Mock being in a subgraph initially
    mockApp.canvas.subgraph = { id: 'test-subgraph' } as any

    useSubgraphNavigation({
      onSubgraphEnter,
      onSubgraphExit,
      onGraphChange
    })

    // Find the set-graph event listener
    const setGraphCall = mockEventListener.mock.calls.find(
      (call) => call[1] === 'litegraph:set-graph'
    )
    expect(setGraphCall).toBeDefined()
    if (!setGraphCall) throw new Error('Event listener not found')

    const handler = setGraphCall[2]

    // Simulate first call (initialize state)
    const mockGraph = { id: 'subgraph' } as LGraph
    handler({
      detail: { newGraph: mockGraph }
    })

    // Simulate exiting subgraph (subgraph becomes null)
    mockApp.canvas.subgraph = null
    const newMockGraph = { id: 'main-graph' } as LGraph
    handler({
      detail: { newGraph: newMockGraph }
    })

    expect(onSubgraphExit).toHaveBeenCalledOnce()
    expect(onSubgraphEnter).not.toHaveBeenCalled()
  })

  it('should not call callbacks when no graph change occurs', async () => {
    useSubgraphNavigation({
      onSubgraphEnter,
      onSubgraphExit,
      onGraphChange
    })

    // Find the set-graph event listener
    const setGraphCall = mockEventListener.mock.calls.find(
      (call) => call[1] === 'litegraph:set-graph'
    )
    expect(setGraphCall).toBeDefined()
    if (!setGraphCall) throw new Error('Event listener not found')

    const handler = setGraphCall[2]

    // Simulate same graph (no change)
    const mockGraph = { id: 'same-graph' } as LGraph
    handler({
      detail: { newGraph: mockGraph }
    })
    handler({
      detail: { newGraph: mockGraph }
    })

    expect(onSubgraphEnter).not.toHaveBeenCalled()
    expect(onSubgraphExit).not.toHaveBeenCalled()
  })

  it('should handle missing callbacks gracefully', async () => {
    expect(() => {
      useSubgraphNavigation({})
    }).not.toThrow()

    // Find and trigger event handlers
    const subgraphOpenedCall = mockEventListener.mock.calls.find(
      (call) => call[1] === 'subgraph-opened'
    )
    const setGraphCall = mockEventListener.mock.calls.find(
      (call) => call[1] === 'litegraph:set-graph'
    )

    expect(() => {
      subgraphOpenedCall?.[2]()
      setGraphCall?.[2]({ detail: { newGraph: { id: 'test' } } })
    }).not.toThrow()
  })

  it('should track graph state correctly across multiple transitions', async () => {
    useSubgraphNavigation({
      onSubgraphEnter,
      onSubgraphExit,
      onGraphChange
    })

    const setGraphCall = mockEventListener.mock.calls.find(
      (call) => call[1] === 'litegraph:set-graph'
    )
    expect(setGraphCall).toBeDefined()
    if (!setGraphCall) throw new Error('Event listener not found')

    const handler = setGraphCall[2]

    // Start in main graph
    mockApp.canvas.subgraph = null
    const mainGraph = { id: 'main' } as LGraph
    handler({ detail: { newGraph: mainGraph } })

    // Enter subgraph
    mockApp.canvas.subgraph = { id: 'sub1' } as any
    const subGraph1 = { id: 'sub1' } as LGraph
    handler({ detail: { newGraph: subGraph1 } })

    // Exit back to main
    mockApp.canvas.subgraph = null
    handler({ detail: { newGraph: mainGraph } })

    // Should only trigger exit once (when actually exiting subgraph)
    expect(onSubgraphExit).toHaveBeenCalledOnce()
  })
})
