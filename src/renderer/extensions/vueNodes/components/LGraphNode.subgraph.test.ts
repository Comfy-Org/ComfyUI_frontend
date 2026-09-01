/**
 * Tests for NodeHeader subgraph functionality
 */
import { createTestingPinia } from '@pinia/testing'
import { render, screen, fireEvent } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type {
  LGraph,
  LGraphNode as LGLGraphNode,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import LGraphNode from '@/renderer/extensions/vueNodes/components/LGraphNode.vue'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'

const mockApp: { rootGraph?: Partial<LGraph> } = vi.hoisted(() => ({}))
// Mock dependencies
vi.mock('@/scripts/app', () => ({
  app: mockApp
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  getNodeByLocatorId: vi.fn(),
  getLocatorIdFromNodeData: vi.fn((nodeData) =>
    nodeData.subgraphId
      ? `${nodeData.subgraphId}:${String(nodeData.id)}`
      : String(nodeData.id)
  )
}))

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => ({
    toastErrorHandler: vi.fn()
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: vi.fn((key) => key)
  }),
  createI18n: vi.fn(() => ({
    global: {
      t: vi.fn((key) => key)
    }
  }))
}))

vi.mock('@/i18n', () => ({
  st: vi.fn((key) => key),
  t: vi.fn((key) => key),
  i18n: {
    global: {
      t: vi.fn((key) => key)
    }
  }
}))

describe('Vue Node - Subgraph Functionality', () => {
  // Helper to setup common mocks
  const setupMocks = async (isSubgraph = true, hasGraph = true) => {
    if (hasGraph) mockApp.rootGraph = {}
    else mockApp.rootGraph = undefined

    vi.mocked(getNodeByLocatorId).mockReturnValue({
      isSubgraphNode: (): this is SubgraphNode => isSubgraph
    } as LGLGraphNode)
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createMockNodeData = (
    id: string,
    subgraphId?: string
  ): VueNodeData => ({
    id,
    title: 'Test Node',
    type: 'TestNode',
    mode: 0,
    selected: false,
    executing: false,
    subgraphId,
    widgets: [],
    inputs: [],
    outputs: [],
    hasErrors: false,
    flags: {}
  })

  const renderComponent = (props: { nodeData: VueNodeData }) => {
    return render(LGraphNode, {
      props,
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
        mocks: {
          $t: vi.fn((key: string) => key),
          $primevue: { config: {} }
        }
      }
    })
  }

  it('should show subgraph button for subgraph nodes', async () => {
    await setupMocks(true) // isSubgraph = true

    renderComponent({
      nodeData: createMockNodeData('test-node-1')
    })

    await nextTick()

    expect(screen.getByTestId('subgraph-enter-button')).toBeInTheDocument()
  })

  it('should not show subgraph button for regular nodes', async () => {
    await setupMocks(false) // isSubgraph = false

    renderComponent({
      nodeData: createMockNodeData('test-node-1')
    })

    await nextTick()

    expect(
      screen.queryByTestId('subgraph-enter-button')
    ).not.toBeInTheDocument()
  })

  it('should handle subgraph context correctly', async () => {
    await setupMocks(true) // isSubgraph = true

    renderComponent({
      nodeData: createMockNodeData('test-node-1', 'subgraph-id')
    })

    await nextTick()

    // Should call getNodeByLocatorId with correct locator ID
    expect(vi.mocked(getNodeByLocatorId)).toHaveBeenCalledWith(
      expect.anything(),
      'subgraph-id:test-node-1'
    )

    expect(screen.getByTestId('subgraph-enter-button')).toBeInTheDocument()
  })

  it('should prevent click event propagation on subgraph button', async () => {
    await setupMocks(true) // isSubgraph = true

    const { container } = renderComponent({
      nodeData: createMockNodeData('test-node-1')
    })

    await nextTick()

    const parentListener = vi.fn()
    // eslint-disable-next-line testing-library/no-container
    container.addEventListener('click', parentListener)

    const subgraphButton = screen.getByTestId('subgraph-enter-button')

    // eslint-disable-next-line testing-library/prefer-user-event
    await fireEvent.click(subgraphButton)

    expect(parentListener).not.toHaveBeenCalled()
  })
})
