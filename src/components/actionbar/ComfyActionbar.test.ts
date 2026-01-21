import { mount } from '@vue/test-utils'
import type { MenuItem } from 'primevue/menuitem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { createI18n } from 'vue-i18n'

import ComfyActionbar from '@/components/actionbar/ComfyActionbar.vue'

const queueStoreMock = reactive({
  pendingTasks: [] as Array<{ promptId?: string }>,
  runningTasks: [] as Array<{ promptId?: string }>
})

const executionStoreMock = reactive({
  isIdle: true,
  clearInitializationByPromptIds: vi.fn()
})

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: vi.fn((key: string) => (key === 'Comfy.UseNewMenu' ? 'Top' : null))
  })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackUiButtonClicked: vi.fn()
  })
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({
    execute: vi.fn()
  })
}))

vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: () => executionStoreMock
}))

vi.mock('@/stores/queueStore', () => ({
  useQueueStore: () => queueStoreMock
}))

function createWrapper() {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        sideToolbar: {
          queueProgressOverlay: {
            activeJobsShort: '{count} active | {count} active',
            clearQueueTooltip: 'Clear queue',
            viewJobHistory: 'View job history',
            expandCollapsedQueue: 'Expand job queue'
          }
        },
        menu: {
          interrupt: 'Interrupt'
        }
      }
    }
  })

  return mount(ComfyActionbar, {
    props: {
      docked: true,
      queueOverlayExpanded: false
    },
    global: {
      plugins: [i18n],
      stubs: {
        Panel: true,
        ComfyRunButton: true,
        QueueInlineProgress: true,
        QueueInlineProgressSummary: true,
        ContextMenu: {
          name: 'ContextMenu',
          props: ['model'],
          template: '<div />'
        }
      },
      directives: {
        tooltip: () => {}
      }
    }
  })
}

describe('ComfyActionbar', () => {
  beforeEach(() => {
    queueStoreMock.pendingTasks = []
    queueStoreMock.runningTasks = []
  })

  it('shows the active jobs label with the current count', async () => {
    const wrapper = createWrapper()
    queueStoreMock.pendingTasks = [{ promptId: 'pending-1' }]
    queueStoreMock.runningTasks = [
      { promptId: 'running-1' },
      { promptId: 'running-2' }
    ]

    await nextTick()

    const queueButton = wrapper.find('[data-testid="queue-overlay-toggle"]')
    expect(queueButton.text()).toContain('3 active')
  })

  it('disables the clear queue context menu item when no queued jobs exist', () => {
    const wrapper = createWrapper()
    const menu = wrapper.findComponent({ name: 'ContextMenu' })
    const model = menu.props('model') as MenuItem[]
    expect(model[0]?.label).toBe('Clear queue')
    expect(model[0]?.disabled).toBe(true)
  })

  it('enables the clear queue context menu item when queued jobs exist', async () => {
    const wrapper = createWrapper()
    queueStoreMock.pendingTasks = [{ promptId: 'pending-1' }]

    await nextTick()

    const menu = wrapper.findComponent({ name: 'ContextMenu' })
    const model = menu.props('model') as MenuItem[]
    expect(model[0]?.disabled).toBe(false)
  })
})
