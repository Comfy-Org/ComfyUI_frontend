import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import TopMenuSection from '@/components/TopMenuSection.vue'
import CurrentUserButton from '@/components/topbar/CurrentUserButton.vue'
import LoginButton from '@/components/topbar/LoginButton.vue'
import type {
  JobListItem,
  JobStatus
} from '@/platform/remote/comfyui/jobs/jobTypes'
import { useSettingStore } from '@/platform/settings/settingStore'
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

function createWrapper(pinia = createTestingPinia({ createSpy: vi.fn })) {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        sideToolbar: {
          queueProgressOverlay: {
            viewJobHistory: 'View job history',
            expandCollapsedQueue: 'Expand collapsed queue',
            activeJobsShort: '{count} active | {count} active'
          }
        }
      }
    }
  })

  return mount(TopMenuSection, {
    global: {
      plugins: [pinia, i18n],
      stubs: {
        SubgraphBreadcrumb: true,
        QueueProgressOverlay: true,
        CurrentUserButton: true,
        LoginButton: true
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
    const wrapper = createWrapper(pinia)

    await nextTick()

    expect(wrapper.find('[data-testid="queue-overlay-toggle"]').exists()).toBe(
      true
    )
    expect(
      wrapper.findComponent({ name: 'QueueProgressOverlay' }).exists()
    ).toBe(false)
  })

  it('opens the assets sidebar tab when QPO V2 is enabled', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const settingStore = useSettingStore(pinia)
    vi.mocked(settingStore.get).mockImplementation((key) =>
      key === 'Comfy.Queue.QPOV2' ? true : undefined
    )
    const wrapper = createWrapper(pinia)
    const sidebarTabStore = useSidebarTabStore(pinia)

    await wrapper.find('[data-testid="queue-overlay-toggle"]').trigger('click')

    expect(sidebarTabStore.activeSidebarTabId).toBe('assets')
  })
})
