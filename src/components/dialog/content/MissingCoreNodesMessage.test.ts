import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Message from 'primevue/message'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import MissingCoreNodesMessage from '@/components/dialog/content/MissingCoreNodesMessage.vue'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { SystemStats } from '@/schemas/apiSchema'
import { useSystemStatsStore } from '@/stores/systemStatsStore'

// Mock the stores
vi.mock('@/stores/systemStatsStore', () => ({
  useSystemStatsStore: vi.fn()
}))

function createMockNode(type: string, version?: string): LGraphNode {
  return Object.assign(Object.create(null), {
    type,
    properties: { cnr_id: 'comfy-core', ver: version },
    id: 1,
    title: type,
    pos: [0, 0],
    size: [100, 100],
    flags: {},
    graph: null,
    mode: 0,
    inputs: [],
    outputs: []
  })
}

interface MockSystemStatsStore {
  systemStats: SystemStats | null
  isLoading: boolean
  error: Error | undefined
  isInitialized: boolean
  refetchSystemStats: ReturnType<typeof vi.fn>
  getFormFactor: () => string
}

function createMockSystemStats(
  overrides: Partial<SystemStats['system']> = {}
): SystemStats {
  return {
    system: {
      os: 'linux',
      python_version: '3.10.0',
      embedded_python: false,
      comfyui_version: '1.0.0',
      pytorch_version: '2.0.0',
      argv: [],
      ram_total: 16000000000,
      ram_free: 8000000000,
      ...overrides
    },
    devices: []
  }
}

function createMockSystemStatsStore(): MockSystemStatsStore {
  return {
    systemStats: null,
    isLoading: false,
    error: undefined,
    isInitialized: true,
    refetchSystemStats: vi.fn(),
    getFormFactor: () => 'other'
  }
}

describe('MissingCoreNodesMessage', () => {
  let mockSystemStatsStore: MockSystemStatsStore

  beforeEach(() => {
    vi.clearAllMocks()
    mockSystemStatsStore = createMockSystemStatsStore()
    vi.mocked(useSystemStatsStore).mockReturnValue(
      mockSystemStatsStore as unknown as ReturnType<typeof useSystemStatsStore>
    )
  })

  const mountComponent = (props = {}) => {
    return mount(MissingCoreNodesMessage, {
      global: {
        plugins: [PrimeVue],
        components: { Message },
        mocks: {
          $t: (key: string, params?: { version?: string }) => {
            const translations: Record<string, string> = {
              'loadWorkflowWarning.outdatedVersion': `Some nodes require a newer version of ComfyUI (current: ${params?.version}). Please update to use all nodes.`,
              'loadWorkflowWarning.outdatedVersionGeneric':
                'Some nodes require a newer version of ComfyUI. Please update to use all nodes.',
              'loadWorkflowWarning.coreNodesFromVersion': `Requires ComfyUI ${params?.version}:`
            }
            return translations[key] || key
          }
        }
      },
      props: {
        missingCoreNodes: {},
        ...props
      }
    })
  }

  it('does not render when there are no missing core nodes', () => {
    const wrapper = mountComponent()
    expect(wrapper.findComponent(Message).exists()).toBe(false)
  })

  it('renders message when there are missing core nodes', async () => {
    const missingCoreNodes = {
      '1.2.0': [createMockNode('TestNode', '1.2.0')]
    }

    const wrapper = mountComponent({ missingCoreNodes })
    await nextTick()

    expect(wrapper.findComponent(Message).exists()).toBe(true)
  })

  it('displays current ComfyUI version when available', async () => {
    // Set systemStats directly (store auto-fetches with useAsyncState)
    mockSystemStatsStore.systemStats = createMockSystemStats({
      comfyui_version: '1.0.0'
    })

    const missingCoreNodes = {
      '1.2.0': [createMockNode('TestNode', '1.2.0')]
    }

    const wrapper = mountComponent({ missingCoreNodes })

    // Wait for component to render
    await nextTick()

    // No need to check if fetchSystemStats was called since useAsyncState auto-fetches
    expect(wrapper.text()).toContain(
      'Some nodes require a newer version of ComfyUI (current: 1.0.0)'
    )
  })

  it('displays generic message when version is unavailable', async () => {
    // No systemStats set - version unavailable
    mockSystemStatsStore.systemStats = null

    const missingCoreNodes = {
      '1.2.0': [createMockNode('TestNode', '1.2.0')]
    }

    const wrapper = mountComponent({ missingCoreNodes })

    // Wait for the async operations to complete
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await nextTick()

    expect(wrapper.text()).toContain(
      'Some nodes require a newer version of ComfyUI. Please update to use all nodes.'
    )
  })

  it('groups nodes by version and displays them', async () => {
    const missingCoreNodes = {
      '1.2.0': [
        createMockNode('NodeA', '1.2.0'),
        createMockNode('NodeB', '1.2.0')
      ],
      '1.3.0': [createMockNode('NodeC', '1.3.0')]
    }

    const wrapper = mountComponent({ missingCoreNodes })
    await nextTick()

    const text = wrapper.text()
    expect(text).toContain('Requires ComfyUI 1.3.0:')
    expect(text).toContain('NodeC')
    expect(text).toContain('Requires ComfyUI 1.2.0:')
    expect(text).toContain('NodeA, NodeB')
  })

  it('sorts versions in descending order', async () => {
    const missingCoreNodes = {
      '1.1.0': [createMockNode('Node1', '1.1.0')],
      '1.3.0': [createMockNode('Node3', '1.3.0')],
      '1.2.0': [createMockNode('Node2', '1.2.0')]
    }

    const wrapper = mountComponent({ missingCoreNodes })
    await nextTick()

    const text = wrapper.text()
    const version13Index = text.indexOf('1.3.0')
    const version12Index = text.indexOf('1.2.0')
    const version11Index = text.indexOf('1.1.0')

    expect(version13Index).toBeLessThan(version12Index)
    expect(version12Index).toBeLessThan(version11Index)
  })

  it('removes duplicate node names within the same version', async () => {
    const missingCoreNodes = {
      '1.2.0': [
        createMockNode('DuplicateNode', '1.2.0'),
        createMockNode('DuplicateNode', '1.2.0'),
        createMockNode('UniqueNode', '1.2.0')
      ]
    }

    const wrapper = mountComponent({ missingCoreNodes })
    await nextTick()

    const text = wrapper.text()
    // Should only appear once in the sorted list
    expect(text).toContain('DuplicateNode, UniqueNode')
    // Count occurrences of 'DuplicateNode' - should be only 1
    const matches = text.match(/DuplicateNode/g) || []
    expect(matches.length).toBe(1)
  })

  it('handles nodes with missing version info', async () => {
    const missingCoreNodes = {
      '': [createMockNode('NoVersionNode')]
    }

    const wrapper = mountComponent({ missingCoreNodes })
    await nextTick()

    expect(wrapper.text()).toContain('Requires ComfyUI unknown:')
    expect(wrapper.text()).toContain('NoVersionNode')
  })
})
