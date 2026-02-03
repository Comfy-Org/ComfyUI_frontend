import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import WorkflowExecutionIndicator from './WorkflowExecutionIndicator.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'workflowExecution.running': 'Workflow is running',
        'workflowExecution.completed': 'Workflow completed successfully',
        'workflowExecution.error': 'Workflow execution failed'
      }
      return translations[key] ?? key
    },
    locale: ref('en')
  })
}))

describe('WorkflowExecutionIndicator', () => {
  it('renders nothing for idle state', () => {
    const wrapper = mount(WorkflowExecutionIndicator, {
      props: { state: 'idle' }
    })
    expect(wrapper.find('i').exists()).toBe(false)
  })

  it('renders spinning loader for running state', () => {
    const wrapper = mount(WorkflowExecutionIndicator, {
      props: { state: 'running' }
    })
    const icon = wrapper.find('i')
    expect(icon.exists()).toBe(true)
    expect(icon.classes()).toContain('icon-[lucide--loader-circle]')
    expect(icon.classes()).toContain('animate-spin')
    expect(icon.classes()).toContain('text-muted-foreground')
  })

  it('renders check icon for completed state', () => {
    const wrapper = mount(WorkflowExecutionIndicator, {
      props: { state: 'completed' }
    })
    const icon = wrapper.find('i')
    expect(icon.exists()).toBe(true)
    expect(icon.classes()).toContain('icon-[lucide--circle-check]')
    expect(icon.classes()).toContain('text-jade-600')
  })

  it('renders alert icon for error state', () => {
    const wrapper = mount(WorkflowExecutionIndicator, {
      props: { state: 'error' }
    })
    const icon = wrapper.find('i')
    expect(icon.exists()).toBe(true)
    expect(icon.classes()).toContain('icon-[lucide--circle-alert]')
    expect(icon.classes()).toContain('text-coral-600')
  })

  it('has correct aria-label for running state', () => {
    const wrapper = mount(WorkflowExecutionIndicator, {
      props: { state: 'running' }
    })
    expect(wrapper.find('i').attributes('aria-label')).toBe(
      'Workflow is running'
    )
  })
})
