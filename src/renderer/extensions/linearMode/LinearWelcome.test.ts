import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import LinearWelcome from './LinearWelcome.vue'

const hasNodes = ref(false)
const hasOutputs = ref(false)
const enterBuilder = vi.fn()

const { setModeFn, showFn } = vi.hoisted(() => ({
  setModeFn: vi.fn(),
  showFn: vi.fn()
}))

vi.mock('@/composables/useAppMode', () => ({
  useAppMode: () => ({ setMode: setModeFn })
}))

vi.mock('@/composables/useWorkflowTemplateSelectorDialog', () => ({
  useWorkflowTemplateSelectorDialog: () => ({ show: showFn })
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
    vi.resetAllMocks()
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

  it('shows getStarted content when hasOutputs is true', () => {
    const wrapper = mountComponent({ hasOutputs: true })
    expect(wrapper.text()).toContain('linearMode.welcome.getStarted')
    expect(
      wrapper.find('[data-testid="linear-welcome-back-to-workflow"]').exists()
    ).toBe(false)
  })

  it('shows load template button when hasNodes is false and clicking calls show', async () => {
    const wrapper = mountComponent({ hasNodes: false })
    const loadBtn = wrapper.find('[data-testid="linear-welcome-load-template"]')
    expect(loadBtn.exists()).toBe(true)

    await loadBtn.trigger('click')
    expect(showFn).toHaveBeenCalledWith('appbuilder')
  })

  it('back-to-workflow button calls setMode with graph', async () => {
    const wrapper = mountComponent()
    await wrapper
      .find('[data-testid="linear-welcome-back-to-workflow"]')
      .trigger('click')
    expect(setModeFn).toHaveBeenCalledWith('graph')
  })
})
