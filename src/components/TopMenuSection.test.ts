import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import type { MenuItem } from 'primevue/menuitem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, onMounted } from 'vue'
import type { Component } from 'vue'
import { createI18n } from 'vue-i18n'

import TopMenuSection from '@/components/TopMenuSection.vue'
import CurrentUserButton from '@/components/topbar/CurrentUserButton.vue'
import LoginButton from '@/components/topbar/LoginButton.vue'
import type {
  JobListItem,
  JobStatus
} from '@/platform/remote/comfyui/jobs/jobTypes'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCommandStore } from '@/stores/commandStore'
import { TaskItemImpl, useQueueStore } from '@/stores/queueStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { isElectron } from '@/utils/envUtil'

const mockData = vi.hoisted(() => ({ isLoggedIn: false }))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => {
    return {
      isLoggedIn: computed(() => mockData.isLoggedIn)
    }
  }
}))

vi.mock('@/utils/envUtil')
vi.mock('@/stores/firebaseAuthStore', () => ({
  useFirebaseAuthStore: vi.fn(() => ({
    currentUser: null,
    loading: false
  }))
}))

type WrapperOptions = {
  pinia?: ReturnType<typeof createTestingPinia>
  stubs?: Record<string, boolean | Component>
  attachTo?: HTMLElement
}

function createWrapper({
  pinia = createTestingPinia({ createSpy: vi.fn }),
  stubs = {},
  attachTo
}: WrapperOptions = {}) {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        sideToolbar: {
          queueProgressOverlay: {
            viewJobHistory: 'View job history',
            expandCollapsedQueue: 'Expand collapsed queue',
            activeJobsShort: '{count} active | {count} active',
            clearQueueTooltip: 'Clear queue'
          }
        }
      }
    }
  })

  return mount(TopMenuSection, {
    attachTo,
    global: {
      plugins: [pinia, i18n],
      stubs: {
        SubgraphBreadcrumb: true,
        QueueProgressOverlay: true,
        QueueInlineProgressSummary: true,
        CurrentUserButton: true,
        LoginButton: true,
        ContextMenu: {
          name: 'ContextMenu',
          props: ['model'],
          template: '<div />'
        },
        ...stubs
      },
      directives: {
        tooltip: () => {}
      }
    }
  })
}

function createJob(id: string, status: JobStatus): JobListItem {
  return {
    id,
    status,
    create_time: 0,
    priority: 0
  }
}

function createTask(id: string, status: JobStatus): TaskItemImpl {
  return new TaskItemImpl(createJob(id, status))
}

describe('TopMenuSection', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    localStorage.clear()
  })

  describe('authentication state', () => {
    describe('when user is logged in', () => {
      beforeEach(() => {
        mockData.isLoggedIn = true
      })

      it('should display CurrentUserButton and not display LoginButton', () => {
        const wrapper = createWrapper()
        expect(wrapper.findComponent(CurrentUserButton).exists()).toBe(true)
        expect(wrapper.findComponent(LoginButton).exists()).toBe(false)
      })
    })

    describe('when user is not logged in', () => {
      beforeEach(() => {
        mockData.isLoggedIn = false
      })

      describe('on desktop platform', () => {
        it('should display LoginButton and not display CurrentUserButton', () => {
          vi.mocked(isElectron).mockReturnValue(true)
          const wrapper = createWrapper()
          expect(wrapper.findComponent(LoginButton).exists()).toBe(true)
          expect(wrapper.findComponent(CurrentUserButton).exists()).toBe(false)
        })
      })

      describe('on web platform', () => {
        it('should not display CurrentUserButton and not display LoginButton', () => {
          const wrapper = createWrapper()
          expect(wrapper.findComponent(CurrentUserButton).exists()).toBe(false)
          expect(wrapper.findComponent(LoginButton).exists()).toBe(false)
        })
      })
    })
  })

  it('shows the active jobs label with the current count', async () => {
    const wrapper = createWrapper()
    const queueStore = useQueueStore()
    queueStore.pendingTasks = [createTask('pending-1', 'pending')]
    queueStore.runningTasks = [
      createTask('running-1', 'in_progress'),
      createTask('running-2', 'in_progress')
    ]

    await nextTick()

    const queueButton = wrapper.find('[data-testid="queue-overlay-toggle"]')
    expect(queueButton.text()).toContain('3 active')
  })

  it('hides queue progress overlay when QPO V2 is enabled', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const settingStore = useSettingStore(pinia)
    vi.mocked(settingStore.get).mockImplementation((key) =>
      key === 'Comfy.Queue.QPOV2' ? true : undefined
    )
    const wrapper = createWrapper({ pinia })

    await nextTick()

    expect(wrapper.find('[data-testid="queue-overlay-toggle"]').exists()).toBe(
      true
    )
    expect(
      wrapper.findComponent({ name: 'QueueProgressOverlay' }).exists()
    ).toBe(false)
  })

  it('toggles the queue progress overlay when QPO V2 is disabled', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
    const settingStore = useSettingStore(pinia)
    vi.mocked(settingStore.get).mockImplementation((key) =>
      key === 'Comfy.Queue.QPOV2' ? false : undefined
    )
    const wrapper = createWrapper({ pinia })
    const commandStore = useCommandStore(pinia)

    await wrapper.find('[data-testid="queue-overlay-toggle"]').trigger('click')

    expect(commandStore.execute).toHaveBeenCalledWith(
      'Comfy.Queue.ToggleOverlay'
    )
  })

  it('opens the assets sidebar tab when QPO V2 is enabled', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
    const settingStore = useSettingStore(pinia)
    vi.mocked(settingStore.get).mockImplementation((key) =>
      key === 'Comfy.Queue.QPOV2' ? true : undefined
    )
    const wrapper = createWrapper({ pinia })
    const sidebarTabStore = useSidebarTabStore(pinia)

    await wrapper.find('[data-testid="queue-overlay-toggle"]').trigger('click')

    expect(sidebarTabStore.activeSidebarTabId).toBe('assets')
  })

  it('toggles the assets sidebar tab when QPO V2 is enabled', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
    const settingStore = useSettingStore(pinia)
    vi.mocked(settingStore.get).mockImplementation((key) =>
      key === 'Comfy.Queue.QPOV2' ? true : undefined
    )
    const wrapper = createWrapper({ pinia })
    const sidebarTabStore = useSidebarTabStore(pinia)
    const toggleButton = wrapper.find('[data-testid="queue-overlay-toggle"]')

    await toggleButton.trigger('click')
    expect(sidebarTabStore.activeSidebarTabId).toBe('assets')

    await toggleButton.trigger('click')
    expect(sidebarTabStore.activeSidebarTabId).toBe(null)
  })

  describe('inline progress summary', () => {
    const configureSettings = (
      pinia: ReturnType<typeof createTestingPinia>,
      qpoV2Enabled: boolean
    ) => {
      const settingStore = useSettingStore(pinia)
      vi.mocked(settingStore.get).mockImplementation((key) => {
        if (key === 'Comfy.Queue.QPOV2') return qpoV2Enabled
        if (key === 'Comfy.UseNewMenu') return 'Top'
        return undefined
      })
    }

    it('renders inline progress summary when QPO V2 is enabled', async () => {
      const pinia = createTestingPinia({ createSpy: vi.fn })
      configureSettings(pinia, true)

      const wrapper = createWrapper({ pinia })

      await nextTick()

      expect(
        wrapper.findComponent({ name: 'QueueInlineProgressSummary' }).exists()
      ).toBe(true)
    })

    it('does not render inline progress summary when QPO V2 is disabled', async () => {
      const pinia = createTestingPinia({ createSpy: vi.fn })
      configureSettings(pinia, false)

      const wrapper = createWrapper({ pinia })

      await nextTick()

      expect(
        wrapper.findComponent({ name: 'QueueInlineProgressSummary' }).exists()
      ).toBe(false)
    })

    it('teleports inline progress summary when actionbar is floating', async () => {
      localStorage.setItem('Comfy.MenuPosition.Docked', 'false')
      const actionbarTarget = document.createElement('div')
      document.body.appendChild(actionbarTarget)
      const pinia = createTestingPinia({ createSpy: vi.fn })
      configureSettings(pinia, true)

      const ComfyActionbarStub = defineComponent({
        name: 'ComfyActionbar',
        setup(_, { emit }) {
          onMounted(() => {
            emit('update:progressTarget', actionbarTarget)
          })
          return () => h('div')
        }
      })

      const wrapper = createWrapper({
        pinia,
        attachTo: document.body,
        stubs: {
          ComfyActionbar: ComfyActionbarStub
        }
      })

      try {
        await nextTick()

        expect(
          actionbarTarget.querySelector('queue-inline-progress-summary-stub')
        ).not.toBeNull()
      } finally {
        wrapper.unmount()
        actionbarTarget.remove()
      }
    })
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
    const queueStore = useQueueStore()
    queueStore.pendingTasks = [createTask('pending-1', 'pending')]

    await nextTick()

    const menu = wrapper.findComponent({ name: 'ContextMenu' })
    const model = menu.props('model') as MenuItem[]
    expect(model[0]?.disabled).toBe(false)
  })
})
