import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import type { MenuItem } from 'primevue/menuitem'
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
import { TaskItemImpl, useQueueStore } from '@/stores/queueStore'
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

function createWrapper() {
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
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn }), i18n],
      stubs: {
        SubgraphBreadcrumb: true,
        QueueProgressOverlay: true,
        CurrentUserButton: true,
        LoginButton: true,
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
