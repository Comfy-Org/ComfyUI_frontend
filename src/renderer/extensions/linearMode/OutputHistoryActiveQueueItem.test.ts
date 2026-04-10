import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import Loader from '@/components/loader/Loader.vue'

import OutputHistoryActiveQueueItem from './OutputHistoryActiveQueueItem.vue'

const i18n = createI18n({ legacy: false, locale: 'en', missingWarn: false })

const { executeFn, runningTasksRef } = vi.hoisted(() => ({
  executeFn: vi.fn(),
  runningTasksRef: { value: [] as Array<{ jobId: string }> }
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({
    execute: executeFn
  })
}))

vi.mock('@/stores/queueStore', () => ({
  useQueueStore: () => ({
    get runningTasks() {
      return runningTasksRef.value
    }
  })
}))

const closeFn = vi.fn()

// Stub Popover to render both slots inline (no portal) so we can test content
const PopoverStub = {
  setup() {
    return { closeFn }
  },
  template: `<div>
    <slot name="button" />
    <slot :close="closeFn" />
  </div>`
}

function mountComponent(queueCount: number) {
  return mount(OutputHistoryActiveQueueItem, {
    props: { queueCount },
    global: {
      plugins: [i18n],
      directives: { tooltip: {} },
      stubs: { Popover: PopoverStub }
    }
  })
}

describe('OutputHistoryActiveQueueItem', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    runningTasksRef.value = []
    vi.resetAllMocks()
  })

  it('hides badge when queueCount is 1', () => {
    const wrapper = mountComponent(1)
    const badge = wrapper.find('[data-testid="linear-job-badge"]')
    expect(badge.exists()).toBe(false)
  })

  it('shows badge with correct count when queueCount is 3', () => {
    const wrapper = mountComponent(3)
    const badge = wrapper.find('[data-testid="linear-job-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('3')
  })

  it('renders Loader with loader-circle variant when running tasks exist', () => {
    runningTasksRef.value = [{ jobId: 'job-1' }]
    const wrapper = mountComponent(1)

    const loader = wrapper.findComponent(Loader)
    expect(loader.exists()).toBe(true)
    expect(loader.props('variant')).toBe('loader-circle')
  })

  it('renders Loader with loader variant when no running tasks', () => {
    runningTasksRef.value = []
    const wrapper = mountComponent(1)

    const loader = wrapper.findComponent(Loader)
    expect(loader.exists()).toBe(true)
    expect(loader.props('variant')).toBe('loader')
  })

  it('hides badge when queueCount is 0', () => {
    const wrapper = mountComponent(0)
    const badge = wrapper.find('[data-testid="linear-job-badge"]')
    expect(badge.exists()).toBe(false)
  })

  it('clicking clear button calls ClearPendingTasks command', async () => {
    const wrapper = mountComponent(3)

    const clearButton = wrapper.find(
      '[data-testid="linear-queue-clear-button"]'
    )
    expect(clearButton.exists()).toBe(true)
    await clearButton.trigger('click')

    expect(executeFn).toHaveBeenCalledWith('Comfy.ClearPendingTasks')
    expect(closeFn).toHaveBeenCalled()
  })

  it('clear button is disabled when queueCount is 0', () => {
    const wrapper = mountComponent(0)

    const clearButton = wrapper.find(
      '[data-testid="linear-queue-clear-button"]'
    )
    expect(clearButton.exists()).toBe(true)
    expect(clearButton.attributes('disabled')).toBeDefined()
  })
})
