/* eslint-disable testing-library/no-container */
/* eslint-disable testing-library/no-node-access */
import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import type { MenuItem } from 'primevue/menuitem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, onMounted, ref } from 'vue'
import type { Component } from 'vue'
import { createI18n } from 'vue-i18n'

import TopMenuSection from '@/components/TopMenuSection.vue'
import QueueNotificationBannerHost from '@/components/queue/QueueNotificationBannerHost.vue'
import type {
  JobListItem,
  JobStatus
} from '@/platform/remote/comfyui/jobs/jobTypes'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCommandStore } from '@/stores/commandStore'
import { useExecutionStore } from '@/stores/executionStore'
import { TaskItemImpl, useQueueStore } from '@/stores/queueStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

const mockData = vi.hoisted(() => ({
  isLoggedIn: false,
  isDesktop: false,
  setShowConflictRedDot: (_value: boolean) => {}
}))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => {
    return {
      isLoggedIn: computed(() => mockData.isLoggedIn)
    }
  }
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false,
  isNightly: false,
  get isDesktop() {
    return mockData.isDesktop
  }
}))

vi.mock('@/platform/updates/common/releaseStore', () => ({
  useReleaseStore: () => ({
    shouldShowRedDot: computed(() => true)
  })
}))

vi.mock(
  '@/workbench/extensions/manager/composables/useConflictAcknowledgment',
  () => {
    const shouldShowConflictRedDot = ref(false)
    mockData.setShowConflictRedDot = (value: boolean) => {
      shouldShowConflictRedDot.value = value
    }

    return {
      useConflictAcknowledgment: () => ({
        shouldShowRedDot: shouldShowConflictRedDot
      })
    }
  }
)

vi.mock('@/workbench/extensions/manager/composables/useManagerState', () => ({
  useManagerState: () => ({
    shouldShowManagerButtons: computed(() => true),
    openManager: vi.fn()
  })
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    currentUser: null,
    loading: false
  }))
}))

vi.mock('@/scripts/app', () => ({
  app: {
    menu: {
      element: document.createElement('div')
    }
  }
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

  const user = userEvent.setup()

  const renderOptions: Record<string, unknown> = {
    global: {
      plugins: [pinia, i18n],
      stubs: {
        SubgraphBreadcrumb: true,
        QueueProgressOverlay: true,
        QueueInlineProgressSummary: true,
        QueueNotificationBannerHost: true,
        CurrentUserButton: true,
        LoginButton: true,
        ContextMenu: {
          name: 'ContextMenu',
          props: ['model'],
          template:
            '<div data-testid="context-menu" :data-model="JSON.stringify(model)" />'
        },
        ...stubs
      },
      directives: {
        tooltip: () => {}
      }
    }
  }

  if (attachTo) {
    renderOptions.container = attachTo.appendChild(
      document.createElement('div')
    )
  }

  const { container, unmount } = render(TopMenuSection, renderOptions)

  return { container, unmount, user }
}

function getLegacyCommandsContainer(container: Element): HTMLElement {
  const legacyContainer = container.querySelector(
    '[data-testid="legacy-topbar-container"]'
  )
  if (!(legacyContainer instanceof HTMLElement)) {
    throw new Error('Expected legacy commands container to be present')
  }
  return legacyContainer
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

function createComfyActionbarStub(actionbarTarget: HTMLElement) {
  return defineComponent({
    name: 'ComfyActionbar',
    setup(_, { emit }) {
      onMounted(() => {
        emit('update:progressTarget', actionbarTarget)
      })
      return () => h('div')
    }
  })
}

describe('TopMenuSection', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    localStorage.clear()
    mockData.isDesktop = false
    mockData.isLoggedIn = false
    mockData.setShowConflictRedDot(false)
  })

  it('shows the active jobs label with the current count', async () => {
    createWrapper()
    const queueStore = useQueueStore()
    queueStore.pendingTasks = [createTask('pending-1', 'pending')]
    queueStore.runningTasks = [
      createTask('running-1', 'in_progress'),
      createTask('running-2', 'in_progress')
    ]

    await nextTick()

    const queueButton = screen.getByTestId('queue-overlay-toggle')
    expect(queueButton.textContent).toContain('3 active')
    expect(screen.getByTestId('active-jobs-indicator')).toBeTruthy()
  })

  it('hides the active jobs indicator when no jobs are active', () => {
    createWrapper()

    expect(screen.queryByTestId('active-jobs-indicator')).toBeNull()
  })

  it('hides queue progress overlay when QPO V2 is enabled', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const settingStore = useSettingStore(pinia)
    vi.mocked(settingStore.get).mockImplementation((key) =>
      key === 'Comfy.Queue.QPOV2' ? true : undefined
    )
    const { container } = createWrapper({ pinia })

    await nextTick()

    expect(screen.getByTestId('queue-overlay-toggle')).toBeTruthy()
    expect(container.querySelector('queue-progress-overlay-stub')).toBeNull()
  })

  it('toggles the queue progress overlay when QPO V2 is disabled', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
    const settingStore = useSettingStore(pinia)
    vi.mocked(settingStore.get).mockImplementation((key) =>
      key === 'Comfy.Queue.QPOV2' ? false : undefined
    )
    const { user } = createWrapper({ pinia })
    const commandStore = useCommandStore(pinia)

    await user.click(screen.getByTestId('queue-overlay-toggle'))

    expect(commandStore.execute).toHaveBeenCalledWith(
      'Comfy.Queue.ToggleOverlay'
    )
  })

  it('opens the job history sidebar tab when QPO V2 is enabled', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
    const settingStore = useSettingStore(pinia)
    vi.mocked(settingStore.get).mockImplementation((key) =>
      key === 'Comfy.Queue.QPOV2' ? true : undefined
    )
    const { user } = createWrapper({ pinia })
    const sidebarTabStore = useSidebarTabStore(pinia)

    await user.click(screen.getByTestId('queue-overlay-toggle'))

    expect(sidebarTabStore.activeSidebarTabId).toBe('job-history')
  })

  it('toggles the job history sidebar tab when QPO V2 is enabled', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
    const settingStore = useSettingStore(pinia)
    vi.mocked(settingStore.get).mockImplementation((key) =>
      key === 'Comfy.Queue.QPOV2' ? true : undefined
    )
    const { user } = createWrapper({ pinia })
    const sidebarTabStore = useSidebarTabStore(pinia)
    const toggleButton = screen.getByTestId('queue-overlay-toggle')

    await user.click(toggleButton)
    expect(sidebarTabStore.activeSidebarTabId).toBe('job-history')

    await user.click(toggleButton)
    expect(sidebarTabStore.activeSidebarTabId).toBe(null)
  })

  describe('inline progress summary', () => {
    const configureSettings = (
      pinia: ReturnType<typeof createTestingPinia>,
      qpoV2Enabled: boolean,
      showRunProgressBar = true
    ) => {
      const settingStore = useSettingStore(pinia)
      vi.mocked(settingStore.get).mockImplementation((key) => {
        if (key === 'Comfy.Queue.QPOV2') return qpoV2Enabled
        if (key === 'Comfy.Queue.ShowRunProgressBar') return showRunProgressBar
        if (key === 'Comfy.UseNewMenu') return 'Top'
        return undefined
      })
    }

    it('renders inline progress summary when QPO V2 is enabled', async () => {
      const pinia = createTestingPinia({ createSpy: vi.fn })
      configureSettings(pinia, true)

      const { container } = createWrapper({ pinia })

      await nextTick()

      expect(
        container.querySelector('queue-inline-progress-summary-stub')
      ).not.toBeNull()
    })

    it('does not render inline progress summary when QPO V2 is disabled', async () => {
      const pinia = createTestingPinia({ createSpy: vi.fn })
      configureSettings(pinia, false)

      const { container } = createWrapper({ pinia })

      await nextTick()

      expect(
        container.querySelector('queue-inline-progress-summary-stub')
      ).toBeNull()
    })

    it('does not render inline progress summary when run progress bar is disabled', async () => {
      const pinia = createTestingPinia({ createSpy: vi.fn })
      configureSettings(pinia, true, false)

      const { container } = createWrapper({ pinia })

      await nextTick()

      expect(
        container.querySelector('queue-inline-progress-summary-stub')
      ).toBeNull()
    })

    it('teleports inline progress summary when actionbar is floating', async () => {
      localStorage.setItem('Comfy.MenuPosition.Docked', 'false')
      const actionbarTarget = document.createElement('div')
      document.body.appendChild(actionbarTarget)
      const pinia = createTestingPinia({ createSpy: vi.fn })
      configureSettings(pinia, true)
      const executionStore = useExecutionStore(pinia)
      executionStore.activeJobId = 'job-1'

      const ComfyActionbarStub = createComfyActionbarStub(actionbarTarget)

      const { unmount } = createWrapper({
        pinia,
        attachTo: document.body,
        stubs: {
          ComfyActionbar: ComfyActionbarStub,
          QueueInlineProgressSummary: false
        }
      })

      try {
        await nextTick()

        expect(actionbarTarget.querySelector('[role="status"]')).not.toBeNull()
      } finally {
        unmount()
        actionbarTarget.remove()
      }
    })
  })

  describe(QueueNotificationBannerHost, () => {
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

    it('renders queue notification banners when QPO V2 is enabled', async () => {
      const pinia = createTestingPinia({ createSpy: vi.fn })
      configureSettings(pinia, true)

      const { container } = createWrapper({ pinia })

      await nextTick()

      expect(
        container.querySelector('queue-notification-banner-host-stub')
      ).not.toBeNull()
    })

    it('renders queue notification banners when QPO V2 is disabled', async () => {
      const pinia = createTestingPinia({ createSpy: vi.fn })
      configureSettings(pinia, false)

      const { container } = createWrapper({ pinia })

      await nextTick()

      expect(
        container.querySelector('queue-notification-banner-host-stub')
      ).not.toBeNull()
    })

    it('renders inline summary above banners when both are visible', async () => {
      const pinia = createTestingPinia({ createSpy: vi.fn })
      configureSettings(pinia, true)
      const { container } = createWrapper({ pinia })

      await nextTick()

      const html = container.innerHTML
      const inlineSummaryIndex = html.indexOf(
        'queue-inline-progress-summary-stub'
      )
      const queueBannerIndex = html.indexOf(
        'queue-notification-banner-host-stub'
      )

      expect(inlineSummaryIndex).toBeGreaterThan(-1)
      expect(queueBannerIndex).toBeGreaterThan(-1)
      expect(inlineSummaryIndex).toBeLessThan(queueBannerIndex)
    })

    it('does not teleport queue notification banners when actionbar is floating', async () => {
      localStorage.setItem('Comfy.MenuPosition.Docked', 'false')
      const actionbarTarget = document.createElement('div')
      document.body.appendChild(actionbarTarget)
      const pinia = createTestingPinia({ createSpy: vi.fn })
      configureSettings(pinia, true)
      const executionStore = useExecutionStore(pinia)
      executionStore.activeJobId = 'job-1'

      const ComfyActionbarStub = createComfyActionbarStub(actionbarTarget)

      const { container, unmount } = createWrapper({
        pinia,
        attachTo: document.body,
        stubs: {
          ComfyActionbar: ComfyActionbarStub,
          QueueNotificationBannerHost: true
        }
      })

      try {
        await nextTick()

        expect(
          actionbarTarget.querySelector('queue-notification-banner-host-stub')
        ).toBeNull()
        expect(
          container.querySelector('queue-notification-banner-host-stub')
        ).not.toBeNull()
      } finally {
        unmount()
        actionbarTarget.remove()
      }
    })
  })

  it('disables the clear queue context menu item when no queued jobs exist', () => {
    const { container } = createWrapper()
    const menuEl = container.querySelector('[data-testid="context-menu"]')
    const model = JSON.parse(
      menuEl?.getAttribute('data-model') ?? '[]'
    ) as MenuItem[]
    expect(model[0]?.label).toBe('Clear queue')
    expect(model[0]?.disabled).toBe(true)
  })

  it('enables the clear queue context menu item when queued jobs exist', async () => {
    const { container } = createWrapper()
    const queueStore = useQueueStore()
    queueStore.pendingTasks = [createTask('pending-1', 'pending')]

    await nextTick()

    const menuEl = container.querySelector('[data-testid="context-menu"]')
    const model = JSON.parse(
      menuEl?.getAttribute('data-model') ?? '[]'
    ) as MenuItem[]
    expect(model[0]?.disabled).toBe(false)
  })

  it('shows manager red dot only for manager conflicts', async () => {
    const { container } = createWrapper()

    // Release red dot is mocked as true globally for this test file.
    expect(container.querySelector('span.bg-red-500')).toBeNull()

    mockData.setShowConflictRedDot(true)
    await nextTick()

    expect(container.querySelector('span.bg-red-500')).not.toBeNull()
  })

  it('coalesces legacy topbar mutation scans to one check per frame', async () => {
    localStorage.setItem('Comfy.MenuPosition.Docked', 'false')

    const rafCallbacks: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    const pinia = createTestingPinia({ createSpy: vi.fn })
    const settingStore = useSettingStore(pinia)
    vi.mocked(settingStore.get).mockImplementation((key) => {
      if (key === 'Comfy.UseNewMenu') return 'Top'
      if (key === 'Comfy.UI.TabBarLayout') return 'Default'
      if (key === 'Comfy.RightSidePanel.IsOpen') return true
      return undefined
    })

    const { container, unmount } = createWrapper({
      pinia,
      attachTo: document.body
    })

    try {
      await nextTick()

      const actionbarContainer = container.querySelector('.actionbar-container')
      expect(actionbarContainer).not.toBeNull()
      expect(actionbarContainer!.classList).toContain('w-0')

      const legacyContainer = getLegacyCommandsContainer(container)
      const querySpy = vi.spyOn(legacyContainer, 'querySelector')

      if (rafCallbacks.length > 0) {
        const initialCallbacks = [...rafCallbacks]
        rafCallbacks.length = 0
        initialCallbacks.forEach((callback) => callback(0))
        await nextTick()
      }
      querySpy.mockClear()
      querySpy.mockReturnValue(document.createElement('div'))

      for (let index = 0; index < 3; index++) {
        const outer = document.createElement('div')
        const inner = document.createElement('div')
        inner.textContent = `legacy-${index}`
        outer.appendChild(inner)
        legacyContainer.appendChild(outer)
      }

      await vi.waitFor(() => {
        expect(rafCallbacks.length).toBeGreaterThan(0)
      })
      expect(querySpy).not.toHaveBeenCalled()

      const callbacks = [...rafCallbacks]
      rafCallbacks.length = 0
      callbacks.forEach((callback) => callback(0))
      await nextTick()

      expect(querySpy).toHaveBeenCalledTimes(1)
      expect(actionbarContainer!.classList).toContain('px-2')
    } finally {
      unmount()
      vi.unstubAllGlobals()
    }
  })
})
