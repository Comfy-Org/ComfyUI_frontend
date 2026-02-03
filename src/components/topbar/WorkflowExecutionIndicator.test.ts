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

  it('renders spinning loader for running state', () => {
    const wrapper = mountWithI18n({ state: 'running' })
    const icon = wrapper.find('i')
    expect(icon.exists()).toBe(true)
    expect(icon.classes()).toContain('icon-[lucide--loader-circle]')
    expect(icon.classes()).toContain('animate-spin')
    expect(icon.classes()).toContain('text-muted-foreground')
  })

  it('renders check icon for completed state', () => {
    const wrapper = mountWithI18n({ state: 'completed' })
    const icon = wrapper.find('i')
    expect(icon.exists()).toBe(true)
    expect(icon.classes()).toContain('icon-[lucide--circle-check]')
    expect(icon.classes()).toContain('text-jade-600')
  })

  it('renders alert icon for error state', () => {
    const wrapper = mountWithI18n({ state: 'error' })
    const icon = wrapper.find('i')
    expect(icon.exists()).toBe(true)
    expect(icon.classes()).toContain('icon-[lucide--circle-alert]')
    expect(icon.classes()).toContain('text-coral-600')
  })

  it('has correct aria-label for running state', () => {
    const wrapper = mountWithI18n({ state: 'running' })
    expect(wrapper.find('i').attributes('aria-label')).toBe(
      'Workflow is running'
    )
  })
})
