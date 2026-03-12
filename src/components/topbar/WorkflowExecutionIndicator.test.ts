import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { WorkflowExecutionState } from '@/stores/executionStore'

import WorkflowExecutionIndicator from './WorkflowExecutionIndicator.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      workflowExecution: {
        running: 'Workflow is running',
        completed: 'Workflow completed successfully',
        error: 'Workflow execution failed'
      }
    }
  }
})

describe('WorkflowExecutionIndicator', () => {
  const mountWithI18n = (props: { state: WorkflowExecutionState }) =>
    mount(WorkflowExecutionIndicator, {
      props,
      global: {
        plugins: [i18n]
      }
    })

  it('renders nothing for idle state', () => {
    const wrapper = mountWithI18n({ state: 'idle' })
    expect(wrapper.find('i').exists()).toBe(false)
  })

  it.each<{ state: WorkflowExecutionState; label: string }>([
    { state: 'running', label: 'Workflow is running' },
    { state: 'completed', label: 'Workflow completed successfully' },
    { state: 'error', label: 'Workflow execution failed' }
  ])('renders accessible icon for $state state', ({ state, label }) => {
    const wrapper = mountWithI18n({ state })
    const icon = wrapper.find('i')
    expect(icon.exists()).toBe(true)
    expect(icon.attributes('aria-label')).toBe(label)
  })
})
