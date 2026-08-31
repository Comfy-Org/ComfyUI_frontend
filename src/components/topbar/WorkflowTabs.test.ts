import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PropType, Ref } from 'vue'
import { defineComponent, h, nextTick, reactive } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

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

const overflowObserver = vi.hoisted(() => ({
  isOverflowing: null as unknown as Ref<boolean>
}))
vi.mock('@/composables/element/useOverflowObserver', async () => {
  const { ref } = await import('vue')
  overflowObserver.isOverflowing = ref(false)
  return {
    useOverflowObserver: () => ({
      isOverflowing: overflowObserver.isOverflowing,
      disposed: ref(false),
      checkOverflow: vi.fn(),
      dispose: vi.fn()
    })
  }
})

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
    enabled: { value: boolean }
    gateSettled: { value: boolean }
    toggle: ReturnType<typeof vi.fn>
  }
}))
vi.mock(
  '@/workbench/extensions/agent/stores/agent/agentPanelStore',
  async () => {
    const { reactive, ref } = await import('vue')
    agentPanelHolder.store = {
      isOpen: ref(false),
      enabled: ref(false),
      gateSettled: ref(false),
      toggle: vi.fn(() => {
        agentPanelHolder.store.isOpen.value =
          !agentPanelHolder.store.isOpen.value
      })
    }
    // reactive() unwraps the holder refs on read, matching a real pinia
    // store proxy now that the component reads properties directly.
    return { useAgentPanelStore: () => reactive(agentPanelHolder.store) }
  }
)

vi.mock('@/utils/mouseDownUtil', () => ({
  whileMouseDown: vi.fn()
}))

vi.mock('./WorkflowOverflowMenu.vue', () => ({
  default: defineComponent({
    name: 'WorkflowOverflowMenuStub',
    render: () => h('div', { 'data-testid': 'workflow-overflow-menu' })
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
      plugins: [i18n],
      directives: {
        tooltip: {}
      }
    }
  })

  return { user, ...result }
}

describe('WorkflowTabs feedback button', () => {
  beforeEach(() => {
    distribution.isCloud = false
    distribution.isDesktop = false
    distribution.isNightly = false
    tabBarLayout.value = 'Default'
    openWorkflow.mockReset()
    workflowStore.openWorkflows = []
    workflowStore.activeWorkflow = null
    overflowObserver.isOverflowing.value = false
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

describe('WorkflowTabs agent entry button', () => {
  beforeEach(() => {
    // The component's literal guard reads the runtime global in tests.
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    tabBarLayout.value = 'Default'
    agentPanelHolder.store.enabled.value = true
    agentPanelHolder.store.isOpen.value = false
    agentPanelHolder.store.toggle.mockClear()
  })

  afterEach(() => {
    tabBarLayout.value = 'Default'
    agentPanelHolder.store.enabled.value = false
    agentPanelHolder.store.isOpen.value = false
  })

  it('does not render the entry button in the legacy tab bar even with the flag on', () => {
    tabBarLayout.value = 'Legacy'
    renderComponent()

    expect(
      screen.queryByRole('button', { name: enMessages.agent.askComfyAgent })
    ).toBeNull()
  })

  it('does not render the entry button while the feature flag is off', () => {
    agentPanelHolder.store.enabled.value = false
    renderComponent()

    expect(
      screen.queryByRole('button', { name: enMessages.agent.askComfyAgent })
    ).toBeNull()
  })

  // Two entry controls once shipped side by side after a merge, which broke
  // every role-based lookup of the button in the Playwright suite.
  it('renders exactly one agent entry control', () => {
    renderComponent()

    expect(
      screen.getAllByRole('button', { name: enMessages.agent.askComfyAgent })
    ).toHaveLength(1)
  })

  it('toggles the panel and reflects the pressed state on the button', async () => {
    const { user } = renderComponent()

    const button = screen.getByRole('button', {
      name: enMessages.agent.askComfyAgent
    })
    expect(button).toHaveAttribute('aria-pressed', 'false')

    await user.click(button)

    expect(agentPanelHolder.store.toggle).toHaveBeenCalledTimes(1)
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })

  it('exposes the gate-settled signal on the actions container once the gate settles', async () => {
    renderComponent()

    const actions = screen.getByTestId('integrated-tab-bar-actions')
    expect(actions).not.toHaveAttribute('data-agent-gate-settled')

    agentPanelHolder.store.gateSettled.value = true
    await nextTick()

    expect(actions).toHaveAttribute('data-agent-gate-settled', 'true')
  })
})

describe('WorkflowTabs selection and overflow', () => {
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
    overflowObserver.isOverflowing.value = false
  })

  it('opens the selected workflow again when its tab is activated', async () => {
    const { user } = renderComponent()

    await user.click(screen.getByText('First workflow'))

    expect(openWorkflow).toHaveBeenCalledOnce()
    expect(openWorkflow).toHaveBeenCalledWith(firstWorkflow)
    expect(
      screen.getByRole('button', { name: 'First workflow' })
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('opens another workflow once when its tab is activated', async () => {
    const { user } = renderComponent()

    await user.click(screen.getByText('Second workflow'))

    expect(openWorkflow).toHaveBeenCalledOnce()
    expect(openWorkflow).toHaveBeenCalledWith(secondWorkflow)
  })

  it('opens another workflow when its tab is activated by keyboard', async () => {
    const { user } = renderComponent()
    const secondTab = screen.getByRole('button', { name: 'Second workflow' })

    secondTab.focus()
    await user.keyboard('{Enter}')

    expect(openWorkflow).toHaveBeenCalledOnce()
    expect(openWorkflow).toHaveBeenCalledWith(secondWorkflow)
  })

  it('opens the selected workflow when its tab is activated by keyboard', async () => {
    const { user } = renderComponent()
    const firstTab = screen.getByRole('button', { name: 'First workflow' })

    firstTab.focus()
    await user.keyboard('{Enter}')

    expect(openWorkflow).toHaveBeenCalledOnce()
    expect(openWorkflow).toHaveBeenCalledWith(firstWorkflow)
  })

  it('keeps the real workflow selected when another workflow fails to load', async () => {
    const error = new Error('load failed')
    const errorHandler = vi.fn()
    openWorkflow.mockRejectedValueOnce(error)
    const { user } = renderComponent(errorHandler)

    await user.click(screen.getByText('Second workflow'))

    await vi.waitFor(() => expect(errorHandler).toHaveBeenCalled())
    expect(errorHandler.mock.calls[0][0]).toBe(error)
    expect(
      screen.getByRole('button', { name: 'First workflow' })
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: 'Second workflow' })
    ).toHaveAttribute('aria-pressed', 'false')
  })

  it('keeps overflow controls available when the tab strip overflows', async () => {
    renderComponent()

    overflowObserver.isOverflowing.value = true
    await nextTick()

    expect(
      screen.getByRole('button', { name: 'Scroll Left' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Scroll Right' })
    ).toBeInTheDocument()
    expect(screen.getByTestId('workflow-overflow-menu')).toBeInTheDocument()
  })

  it('scrolls a newly active workflow into view', async () => {
    const originalScrollIntoView = Element.prototype.scrollIntoView
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    const { unmount } = renderComponent()

    workflowStore.activeWorkflow = secondWorkflow
    await vi.waitFor(() =>
      expect(scrollIntoView).toHaveBeenCalledWith({
        block: 'nearest',
        inline: 'nearest'
      })
    )

    unmount()
    Element.prototype.scrollIntoView = originalScrollIntoView
  })
})
