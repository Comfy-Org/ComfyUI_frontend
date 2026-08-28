import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PropType } from 'vue'
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
const openWorkflow = vi.hoisted(() => vi.fn())
const workflowStore = vi.hoisted(() => ({
  openWorkflows: [] as Array<{
    key: string
    path: string
    filename: string
  }>,
  activeWorkflow: null as {
    key: string
    path: string
    filename: string
  } | null
}))
vi.mock('@/platform/support/feedbackDialog', () => ({
  openFeedbackDialog
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
    openWorkflow,
    closeWorkflow: vi.fn()
  })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => reactive(workflowStore)
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
    isVisible: { value: boolean }
    enabled: { value: boolean }
    toggle: ReturnType<typeof vi.fn>
    open: ReturnType<typeof vi.fn>
    suppressRestoredOpen: ReturnType<typeof vi.fn>
  }
}))
vi.mock(
  '@/workbench/extensions/agent/stores/agent/agentPanelStore',
  async () => {
    const { ref } = await import('vue')
    agentPanelHolder.store = {
      isOpen: ref(false),
      isVisible: ref(false),
      enabled: ref(false),
      toggle: vi.fn(() => {
        agentPanelHolder.store.isOpen.value =
          !agentPanelHolder.store.isOpen.value
      }),
      open: vi.fn(() => {
        agentPanelHolder.store.isOpen.value = true
        agentPanelHolder.store.isVisible.value = true
      }),
      suppressRestoredOpen: vi.fn(() => {
        agentPanelHolder.store.isOpen.value = false
      })
    }
    return { useAgentPanelStore: () => agentPanelHolder.store }
  }
)

const withConsent = vi.hoisted(() =>
  vi.fn((onAccept: () => void) => onAccept())
)
vi.mock(
  '@/workbench/extensions/agent/composables/agent/useAgentConsent',
  () => ({ useAgentConsent: () => ({ withConsent }) })
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
    props: {
      workflowOption: {
        type: Object as PropType<{ workflow: { filename: string } }>,
        required: true
      }
    },
    render() {
      return h('div', this.workflowOption.workflow.filename)
    }
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

function renderComponent(errorHandler?: (error: unknown) => void) {
  const user = userEvent.setup()
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })

  const result = render(WorkflowTabs, {
    global: {
      config: { errorHandler },
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
    agentPanelHolder.store.isVisible.value = false
    trackAgentEntryButtonClicked.mockClear()
    agentPanelHolder.store.toggle.mockClear()
    agentPanelHolder.store.open.mockClear()
    agentPanelHolder.store.suppressRestoredOpen.mockClear()
    withConsent.mockClear()
    withConsent.mockImplementation((onAccept: () => void) => onAccept())
  })

  afterEach(() => {
    tabBarLayout.value = 'Legacy'
    agentPanelHolder.store.enabled.value = false
    agentPanelHolder.store.isOpen.value = false
    agentPanelHolder.store.isVisible.value = false
  })

  it('reports the entry click with the state the click produces', async () => {
    const { user } = renderComponent()

    await user.click(
      screen.getByRole('button', { name: enMessages.agent.askComfyAgent })
    )
    expect(trackAgentEntryButtonClicked).toHaveBeenCalledWith({
      resulting_state: 'opened'
    })
    expect(agentPanelHolder.store.open).toHaveBeenCalledTimes(1)

    agentPanelHolder.store.isOpen.value = true
    agentPanelHolder.store.isVisible.value = true
    await user.click(
      screen.getByRole('button', { name: enMessages.agent.askComfyAgent })
    )
    expect(trackAgentEntryButtonClicked).toHaveBeenLastCalledWith({
      resulting_state: 'closed'
    })
  })

  it('gates a restored open intent that is not actually visible', async () => {
    agentPanelHolder.store.isOpen.value = true
    agentPanelHolder.store.isVisible.value = false
    const { user } = renderComponent()

    await user.click(
      screen.getByRole('button', { name: enMessages.agent.askComfyAgent })
    )

    expect(agentPanelHolder.store.toggle).not.toHaveBeenCalled()
    expect(agentPanelHolder.store.suppressRestoredOpen).toHaveBeenCalledOnce()
    expect(withConsent).toHaveBeenCalledOnce()
  })
})

describe('WorkflowTabs creating-tab skeleton', () => {
  const originalScrollIntoView = Element.prototype.scrollIntoView

  beforeEach(() => {
    tabBarLayout.value = 'Default'
  })

  afterEach(() => {
    Element.prototype.scrollIntoView = originalScrollIntoView
  })

  it('renders a skeleton pseudo-tab only while a tab is being created', async () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    renderComponent()
    expect(screen.queryByTestId('creating-tab-skeleton')).toBeNull()
    expect(scrollIntoView).not.toHaveBeenCalled()

    const activity = useWorkflowTabActivityStore()
    activity.setCreating(true)
    await vi.waitFor(() =>
      expect(scrollIntoView).toHaveBeenCalledWith({
        block: 'nearest',
        inline: 'nearest'
      })
    )
    expect(screen.getByTestId('creating-tab-skeleton')).toBeInTheDocument()
    expect(
      screen.getByTestId('creating-tab-skeleton-shimmer')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: enMessages.g.agentWorking })
    ).toBeInTheDocument()

    activity.setCreating(false)
    await nextTick()
    expect(screen.queryByTestId('creating-tab-skeleton')).toBeNull()
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
  })
})

describe('WorkflowTabs feedback button', () => {
  beforeEach(() => {
    distribution.isCloud = false
    distribution.isDesktop = false
    distribution.isNightly = false
    tabBarLayout.value = 'Default'
    openWorkflow.mockReset()
    workflowStore.openWorkflows = []
    workflowStore.activeWorkflow = null
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

    const button = screen.getByRole('button', { name: 'Feedback' })
    expect(button).toBeInTheDocument()
    expect(button).toHaveClass('size-[32px]', 'rounded-[8px]', 'p-[8px]')
    expect(screen.getByTestId('feedback-icon')).toHaveClass(
      'icon-[hugeicons--megaphone-03]',
      'size-[16px]'
    )
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

describe('WorkflowTabs selection', () => {
  const firstWorkflow = {
    key: 'first',
    path: 'first.json',
    filename: 'First workflow'
  }
  const secondWorkflow = {
    key: 'second',
    path: 'second.json',
    filename: 'Second workflow'
  }

  beforeEach(() => {
    workflowStore.openWorkflows = [firstWorkflow, secondWorkflow]
    workflowStore.activeWorkflow = firstWorkflow
    openWorkflow.mockReset()
  })

  it('forwards a click on the selected workflow', async () => {
    const { user } = renderComponent()

    await user.click(screen.getByText('First workflow'))

    expect(openWorkflow).toHaveBeenCalledOnce()
    expect(openWorkflow).toHaveBeenCalledWith(firstWorkflow)
  })

  it('forwards a click on another workflow once', async () => {
    const { user } = renderComponent()

    await user.click(screen.getByText('Second workflow'))

    expect(openWorkflow).toHaveBeenCalledOnce()
    expect(openWorkflow).toHaveBeenCalledWith(secondWorkflow)
  })

  it('forwards a keyboard selection through the select button', async () => {
    const { user } = renderComponent()
    const secondTab = screen.getByRole('button', { name: 'Second workflow' })

    secondTab.focus()
    await user.keyboard('{Enter}')

    expect(openWorkflow).toHaveBeenCalledOnce()
    expect(openWorkflow).toHaveBeenCalledWith(secondWorkflow)
  })

  it('forwards keyboard activation of the selected workflow', async () => {
    const { user } = renderComponent()
    const firstTab = screen.getByRole('button', { name: 'First workflow' })

    firstTab.focus()
    await user.keyboard('{Enter}')

    expect(openWorkflow).toHaveBeenCalledOnce()
    expect(openWorkflow).toHaveBeenCalledWith(firstWorkflow)
  })

  it('forwards workflow load failures to the Vue error handler', async () => {
    const error = new Error('load failed')
    const errorHandler = vi.fn()
    openWorkflow.mockRejectedValueOnce(error)
    const { user } = renderComponent(errorHandler)

    await user.click(screen.getByText('Second workflow'))

    await vi.waitFor(() => {
      expect(errorHandler).toHaveBeenCalled()
    })
    expect(errorHandler.mock.calls[0][0]).toBe(error)
  })
})
