import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import LinearWelcome from './LinearWelcome.vue'

const hasNodes = ref(false)
const hasOutputs = ref(false)
const enterBuilder = vi.fn()

vi.mock('@/composables/useAppMode', () => ({
  useAppMode: () => ({ setMode: vi.fn() })
}))

vi.mock('@/composables/useWorkflowTemplateSelectorDialog', () => ({
  useWorkflowTemplateSelectorDialog: () => ({ show: vi.fn() })
}))

vi.mock('@/stores/appModeStore', () => ({
  useAppModeStore: () => ({
    hasNodes,
    hasOutputs,
    enterBuilder
  })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    activeWorkflow: null
  })
}))

const i18n = createI18n({ legacy: false, locale: 'en', missingWarn: false })

function mountComponent(
  opts: { hasNodes?: boolean; hasOutputs?: boolean } = {}
) {
  hasNodes.value = opts.hasNodes ?? false
  hasOutputs.value = opts.hasOutputs ?? false
  return mount(LinearWelcome, {
    global: { plugins: [i18n] }
  })
}

describe('LinearWelcome', () => {
  beforeEach(() => {
    hasNodes.value = false
    hasOutputs.value = false
    vi.clearAllMocks()
  })

  it('shows empty workflow text when there are no nodes', () => {
    const wrapper = mountComponent({ hasNodes: false })
    expect(
      wrapper.find('[data-testid="linear-welcome-empty-workflow"]').exists()
    ).toBe(true)
    expect(
      wrapper.find('[data-testid="linear-welcome-build-app"]').exists()
    ).toBe(false)
  })

  it('shows build app button when there are nodes but no outputs', () => {
    const wrapper = mountComponent({ hasNodes: true, hasOutputs: false })
    expect(
      wrapper.find('[data-testid="linear-welcome-empty-workflow"]').exists()
    ).toBe(false)
    expect(
      wrapper.find('[data-testid="linear-welcome-build-app"]').exists()
    ).toBe(true)
  })

  it('clicking build app button calls enterBuilder', async () => {
    const wrapper = mountComponent({ hasNodes: true, hasOutputs: false })
    await wrapper
      .find('[data-testid="linear-welcome-build-app"]')
      .trigger('click')
    expect(enterBuilder).toHaveBeenCalled()
  })
})
