import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'

import WorkflowTabs from './WorkflowTabs.vue'

const distribution = vi.hoisted(() => ({
  isCloud: false,
  isDesktop: false,
  isNightly: false
}))

const tabBarLayout = vi.hoisted(() => ({ value: 'Default' }))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return distribution.isCloud
  },
  get isDesktop() {
    return distribution.isDesktop
  },
  get isNightly() {
    return distribution.isNightly
  }
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (key: string) =>
      key === 'Comfy.UI.TabBarLayout' ? tabBarLayout.value : undefined
  })
}))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    isLoggedIn: { value: false },
    userEmail: { value: undefined }
  })
}))

const openFeedbackDialog = vi.hoisted(() => vi.fn())
vi.mock('@/platform/support/feedbackDialog', () => ({
  openFeedbackDialog
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({ flags: { showSignInButton: false } })
}))

vi.mock('@/composables/useWorkflowStatusDismissal', () => ({
  useWorkflowStatusDismissal: vi.fn()
}))

vi.mock('@/composables/element/useOverflowObserver', () => ({
  useOverflowObserver: () => ({
    isOverflowing: { value: false },
    disposed: { value: false },
    checkOverflow: vi.fn(),
    dispose: vi.fn()
  })
}))

vi.mock('@/platform/workflow/core/services/workflowService', () => ({
  useWorkflowService: () => ({
    openWorkflow: vi.fn(),
    closeWorkflow: vi.fn()
  })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () =>
    reactive({
      openWorkflows: [],
      activeWorkflow: null
    })
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({ execute: vi.fn() })
}))

vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: () => ({ shiftDown: false })
}))

const agentPanelHolder = vi.hoisted(() => ({
  store: null as unknown as {
    isOpen: { value: boolean }
    enabled: { value: boolean }
    toggle: ReturnType<typeof vi.fn>
  }
}))
vi.mock(
  '@/workbench/extensions/agent/stores/agent/agentPanelStore',
  async () => {
    const { ref } = await import('vue')
    agentPanelHolder.store = {
      isOpen: ref(false),
      enabled: ref(false),
      toggle: vi.fn(() => {
        agentPanelHolder.store.isOpen.value =
          !agentPanelHolder.store.isOpen.value
      })
    }
    return { useAgentPanelStore: () => agentPanelHolder.store }
  }
)

const trackAgentEntryButtonClicked = vi.hoisted(() => vi.fn())
vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ trackAgentEntryButtonClicked })
}))

vi.mock('@/utils/mouseDownUtil', () => ({
  whileMouseDown: vi.fn()
}))

vi.mock('./WorkflowOverflowMenu.vue', () => ({
  default: defineComponent({
    name: 'WorkflowOverflowMenuStub',
    render: () => h('div')
  })
}))

vi.mock('./WorkflowTab.vue', () => ({
  default: defineComponent({
    name: 'WorkflowTabStub',
    render: () => h('div')
  })
}))

vi.mock('./CurrentUserButton.vue', () => ({
  default: defineComponent({
    name: 'CurrentUserButtonStub',
    render: () => h('div')
  })
}))

vi.mock('./LoginButton.vue', () => ({
  default: defineComponent({
    name: 'LoginButtonStub',
    render: () => h('div')
  })
}))

function renderComponent() {
  const user = userEvent.setup()
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })

  const result = render(WorkflowTabs, {
    global: {
      plugins: [i18n, createPinia()],
      directives: {
        tooltip: {}
      }
    }
  })

  return { user, ...result }
}

describe('WorkflowTabs agent entry button', () => {
  beforeEach(() => {
    tabBarLayout.value = 'Integrated'
    agentPanelHolder.store.enabled.value = true
    agentPanelHolder.store.isOpen.value = false
    trackAgentEntryButtonClicked.mockClear()
    agentPanelHolder.store.toggle.mockClear()
  })

  afterEach(() => {
    tabBarLayout.value = 'Legacy'
    agentPanelHolder.store.enabled.value = false
    agentPanelHolder.store.isOpen.value = false
  })

  it('reports the entry click with the state the click produces', async () => {
    const { user } = renderComponent()

    await user.click(
      screen.getByRole('button', { name: enMessages.agent.askComfyAgent })
    )
    expect(trackAgentEntryButtonClicked).toHaveBeenCalledWith({
      resulting_state: 'opened'
    })
    expect(agentPanelHolder.store.toggle).toHaveBeenCalledTimes(1)

    agentPanelHolder.store.isOpen.value = true
    await user.click(
      screen.getByRole('button', { name: enMessages.agent.askComfyAgent })
    )
    expect(trackAgentEntryButtonClicked).toHaveBeenLastCalledWith({
      resulting_state: 'closed'
    })
  })
})

describe('WorkflowTabs creating-tab skeleton', () => {
  beforeEach(() => {
    tabBarLayout.value = 'Default'
  })

  it('renders a skeleton pseudo-tab only while a tab is being created', async () => {
    renderComponent()
    expect(screen.queryByTestId('creating-tab-skeleton')).toBeNull()

    const activity = useWorkflowTabActivityStore()
    activity.setCreating(true)
    await nextTick()
    expect(screen.getByTestId('creating-tab-skeleton')).toBeTruthy()

    activity.setCreating(false)
    await nextTick()
    expect(screen.queryByTestId('creating-tab-skeleton')).toBeNull()
  })
})

describe('WorkflowTabs feedback button', () => {
  beforeEach(() => {
    distribution.isCloud = false
    distribution.isDesktop = false
    distribution.isNightly = false
    tabBarLayout.value = 'Default'
    openFeedbackDialog.mockReset()
  })

  it('opens the feedback dialog tagged with topbar source when clicked', async () => {
    distribution.isCloud = true
    const { user } = renderComponent()

    await user.click(screen.getByRole('button', { name: 'Feedback' }))

    expect(openFeedbackDialog).toHaveBeenCalledWith('topbar')
  })

  it('renders the feedback button on Nightly', () => {
    distribution.isNightly = true
    renderComponent()

    expect(screen.getByRole('button', { name: 'Feedback' })).toBeInTheDocument()
  })

  it('does not render the feedback button on non-Cloud/non-Nightly builds', () => {
    renderComponent()
    expect(
      screen.queryByRole('button', { name: 'Feedback' })
    ).not.toBeInTheDocument()
  })

  it('does not render the feedback button when the legacy tab bar is active', () => {
    distribution.isCloud = true
    tabBarLayout.value = 'Legacy'
    renderComponent()
    expect(
      screen.queryByRole('button', { name: 'Feedback' })
    ).not.toBeInTheDocument()
  })
})
