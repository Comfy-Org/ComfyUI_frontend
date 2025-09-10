import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'

import { useExecutionStateProvider } from '@/renderer/extensions/vueNodes/execution/useExecutionStateProvider'
import { useNodeExecutionState } from '@/renderer/extensions/vueNodes/execution/useNodeExecutionState'
import { useExecutionStore } from '@/stores/executionStore'

const TestComponent = defineComponent({
  props: {
    nodeId: { type: String, default: 'test-node-123' }
  },
  setup(props) {
    // Provider sets up the injection context
    useExecutionStateProvider()

    // Consumer uses the provided context
    const { executing, progress, progressPercentage, executionState } =
      useNodeExecutionState(props.nodeId)

    return { executing, progress, progressPercentage, executionState }
  },
  template: `
    <div>
      <span data-testid="executing">{{ executing }}</span>
      <span data-testid="progress">{{ progress }}</span>
      <span data-testid="progress-percentage">{{ progressPercentage }}</span>
      <span data-testid="execution-state">{{ executionState }}</span>
    </div>
  `
})

describe('useExecutionStateProvider', () => {
  it('provides execution state that can be consumed by useNodeExecutionState', () => {
    const pinia = createTestingPinia()
    const wrapper = mount(TestComponent, {
      global: { plugins: [pinia] }
    })

    // Test initial state - no nodes executing
    expect(wrapper.find('[data-testid="executing"]').text()).toBe('false')
    expect(wrapper.find('[data-testid="progress"]').text()).toBe('')
    expect(wrapper.find('[data-testid="progress-percentage"]').text()).toBe('')
    expect(wrapper.find('[data-testid="execution-state"]').text()).toBe('idle')

    // Simulate execution state change
    const executionStore = useExecutionStore(pinia)
    executionStore.nodeProgressStates = {
      'test-node-123': {
        node_id: 'test-node-123',
        display_node_id: 'test-node-123',
        prompt_id: 'test-prompt',
        state: 'running',
        value: 5,
        max: 10
      }
    }

    // Should now show executing state
    expect(wrapper.find('[data-testid="executing"]').text()).toBe('true')
    expect(wrapper.find('[data-testid="progress"]').text()).toBe('0.5')
    expect(wrapper.find('[data-testid="progress-percentage"]').text()).toBe(
      '50'
    )
    expect(wrapper.find('[data-testid="execution-state"]').text()).toBe(
      'running'
    )
  })

  it('handles multiple nodes with different execution states', () => {
    const pinia = createTestingPinia()

    // Mount two components for different nodes
    const wrapper1 = mount(TestComponent, {
      props: { nodeId: 'node-1' },
      global: { plugins: [pinia] }
    })

    const wrapper2 = mount(TestComponent, {
      props: { nodeId: 'node-2' },
      global: { plugins: [pinia] }
    })

    const executionStore = useExecutionStore(pinia)
    executionStore.nodeProgressStates = {
      'node-1': {
        node_id: 'node-1',
        display_node_id: 'node-1',
        prompt_id: 'test-prompt',
        state: 'running',
        value: 3,
        max: 10
      },
      'node-2': {
        node_id: 'node-2',
        display_node_id: 'node-2',
        prompt_id: 'test-prompt',
        state: 'finished',
        value: 10,
        max: 10
      }
    }

    // Node 1 should be executing with 30% progress
    expect(wrapper1.find('[data-testid="executing"]').text()).toBe('true')
    expect(wrapper1.find('[data-testid="progress"]').text()).toBe('0.3')
    expect(wrapper1.find('[data-testid="progress-percentage"]').text()).toBe(
      '30'
    )
    expect(wrapper1.find('[data-testid="execution-state"]').text()).toBe(
      'running'
    )

    // Node 2 should be finished (not executing) with 100% progress
    expect(wrapper2.find('[data-testid="executing"]').text()).toBe('false')
    expect(wrapper2.find('[data-testid="progress"]').text()).toBe('1')
    expect(wrapper2.find('[data-testid="progress-percentage"]').text()).toBe(
      '100'
    )
    expect(wrapper2.find('[data-testid="execution-state"]').text()).toBe(
      'finished'
    )
  })

  it('handles nodes without progress data', () => {
    const pinia = createTestingPinia()
    const wrapper = mount(TestComponent, {
      props: { nodeId: 'node-without-progress' },
      global: { plugins: [pinia] }
    })

    const executionStore = useExecutionStore(pinia)
    executionStore.nodeProgressStates = {
      'node-without-progress': {
        node_id: 'node-without-progress',
        display_node_id: 'node-without-progress',
        prompt_id: 'test-prompt',
        state: 'running',
        value: 0,
        max: 0 // No progress info
      }
    }

    // Should be executing but with undefined progress
    expect(wrapper.find('[data-testid="executing"]').text()).toBe('true')
    expect(wrapper.find('[data-testid="progress"]').text()).toBe('')
    expect(wrapper.find('[data-testid="progress-percentage"]').text()).toBe('')
    expect(wrapper.find('[data-testid="execution-state"]').text()).toBe(
      'running'
    )
  })

  it('handles error states', () => {
    const pinia = createTestingPinia()
    const wrapper = mount(TestComponent, {
      props: { nodeId: 'error-node' },
      global: { plugins: [pinia] }
    })

    const executionStore = useExecutionStore(pinia)
    executionStore.nodeProgressStates = {
      'error-node': {
        node_id: 'error-node',
        display_node_id: 'error-node',
        prompt_id: 'test-prompt',
        state: 'error',
        value: 2,
        max: 10
      }
    }

    // Should not be executing (error state) but show error state
    expect(wrapper.find('[data-testid="executing"]').text()).toBe('false')
    expect(wrapper.find('[data-testid="progress"]').text()).toBe('0.2')
    expect(wrapper.find('[data-testid="progress-percentage"]').text()).toBe(
      '20'
    )
    expect(wrapper.find('[data-testid="execution-state"]').text()).toBe('error')
  })
})
