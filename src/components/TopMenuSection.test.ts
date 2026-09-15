/* eslint-disable testing-library/no-container */
/* eslint-disable testing-library/no-node-access */
import { getActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import type { Component } from 'vue'
import { createI18n } from 'vue-i18n'

import { useTelemetry } from '@/platform/telemetry'

import TopMenuSection from '@/components/TopMenuSection.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useReleaseStore } from '@/platform/updates/common/releaseStore'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
vi.mock(import('firebase/auth'))
vi.mock(import('vuefire'), () => ({ useFirebaseAuth: vi.fn() }))

const mockData = vi.hoisted(() => ({
  isLoggedIn: false,
  setShowConflictRedDot: (_value: boolean) => {}
}))

vi.mock<unknown>(import('@/composables/auth/useCurrentUser'), () => ({
  useCurrentUser: () => {
    return {
      isLoggedIn: computed(() => mockData.isLoggedIn)
    }
  }
}))

vi.mock(import('@/platform/distribution/types'), () => ({
  isCloud: false,
  isNightly: false
}))

vi.mock<unknown>(
  import('@/workbench/extensions/manager/composables/useConflictAcknowledgment'),

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

vi.mock<unknown>(
  import('@/workbench/extensions/manager/composables/useManagerState'),

  () => ({
    useManagerState: () => ({
      shouldShowManagerButtons: computed(() => true),
      openManager: vi.fn()
    })
  })
)

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: {
    menu: {
      element: document.createElement('div')
    }
  }
}))

vi.mock(import('@/platform/telemetry'))

type WrapperOptions = {
  pinia?: Pinia
  stubs?: Record<string, boolean | Component>
  attachTo?: HTMLElement
}

function createWrapper({
  pinia = getActivePinia()!,
  stubs = {},
  attachTo
}: WrapperOptions = {}) {
  Object.assign(useReleaseStore(pinia), { shouldShowRedDot: true })
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
        },
        rightSidePanel: {
          togglePanel: 'Toggle properties panel'
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

describe('TopMenuSection', () => {
  beforeEach(() => {
    // The queue status toast instantiates systemStatsStore, which fetches on
    // creation; answer that one request so it does not escape the sandbox.
    const realFetch = globalThis.fetch
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) =>
      String(input).includes('/system_stats')
        ? Promise.resolve(new Response('{}', { status: 200 }))
        : realFetch(input, init)
    )
    mockData.isLoggedIn = false
    mockData.setShowConflictRedDot(false)
  })

  describe('authentication state', () => {
    function createLegacyTabBarWrapper() {
      const pinia = getActivePinia()!
      const settingStore = useSettingStore(pinia)
      vi.mocked(settingStore.get).mockImplementation((key) =>
        key === 'Comfy.UI.TabBarLayout' ? 'Legacy' : undefined
      )
      return createWrapper({ pinia })
    }

    describe('when user is logged in', () => {
      beforeEach(() => {
        mockData.isLoggedIn = true
      })

      it('should display CurrentUserButton and not display LoginButton', () => {
        const { container } = createLegacyTabBarWrapper()
        expect(
          container.querySelector('current-user-button-stub')
        ).not.toBeNull()
        expect(container.querySelector('login-button-stub')).toBeNull()
      })
    })

    describe('when user is not logged in', () => {
      beforeEach(() => {
        mockData.isLoggedIn = false
      })

      it('should display LoginButton and not display CurrentUserButton', () => {
        const { container } = createLegacyTabBarWrapper()
        expect(container.querySelector('login-button-stub')).not.toBeNull()
        expect(container.querySelector('current-user-button-stub')).toBeNull()
      })
    })
  })

  it('hides the active jobs indicator when no jobs are active', () => {
    createWrapper()

    expect(screen.queryByTestId('active-jobs-indicator')).toBeNull()
  })

  it('keeps action bars mounted while hiding the error overlay in node selection mode', () => {
    const pinia = getActivePinia()!
    useAgentNodeSelectionStore(pinia).isActionBarsHidden = true

    createWrapper({
      pinia,
      stubs: {
        ErrorOverlay: {
          template: '<div data-testid="error-overlay" />'
        }
      }
    })

    expect(screen.getByTestId('top-menu-actionbars')).toHaveAttribute(
      'aria-hidden',
      'true'
    )
    expect(screen.queryByTestId('error-overlay')).toBeNull()
  })

  it('tracks right side panel opens', async () => {
    const { user } = createWrapper()

    await user.click(
      screen.getByRole('button', { name: 'Toggle properties panel' })
    )

    expect(useTelemetry()?.trackUiButtonClicked).toHaveBeenCalledWith({
      button_id: 'right_side_panel_opened',
      element_group: 'top_menu'
    })
  })

  describe('queue status', () => {
    const configureSettings = (pinia: Pinia, qpoV2Enabled: boolean) => {
      const settingStore = useSettingStore(pinia)
      vi.mocked(settingStore.get).mockImplementation((key) => {
        if (key === 'Comfy.Queue.QPOV2') return qpoV2Enabled
        if (key === 'Comfy.Queue.ShowRunProgressBar') return true
        if (key === 'Comfy.UseNewMenu') return 'Top'
        return undefined
      })
    }

    it.for([true, false])(
      'renders the queue status toast in place of the legacy queue UI (QPO V2: %s)',
      async (qpoV2Enabled) => {
        const pinia = getActivePinia()!
        configureSettings(pinia, qpoV2Enabled)

        const { container } = createWrapper({
          pinia,
          stubs: { QueueStatusToast: true }
        })

        await nextTick()

        expect(
          container.querySelector('queue-status-toast-stub')
        ).not.toBeNull()
        expect(
          container.querySelector('queue-progress-overlay-stub')
        ).toBeNull()
        expect(
          container.querySelector('queue-inline-progress-summary-stub')
        ).toBeNull()
        expect(
          container.querySelector('queue-notification-banner-host-stub')
        ).toBeNull()
      }
    )
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

    const pinia = getActivePinia()!
    const settingStore = useSettingStore(pinia)
    vi.mocked(settingStore.get).mockImplementation((key) => {
      if (key === 'Comfy.UseNewMenu') return 'Top'
      if (key === 'Comfy.UI.TabBarLayout') return 'Integrated'
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
      expect(actionbarContainer!.classList).not.toContain('w-0')
    } finally {
      unmount()
      vi.unstubAllGlobals()
    }
  })
})
