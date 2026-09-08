import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PropType } from 'vue'
import { defineComponent, h, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useSettingStore } from '@/platform/settings/settingStore'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import WorkflowTabs from './WorkflowTabs.vue'

vi.mock('firebase/auth')
vi.mock('vuefire', () => ({ useFirebaseAuth: vi.fn() }))

const distribution = vi.hoisted(() => ({
  isCloud: false,
  isDesktop: false,
  isNightly: false
}))

const overflowObservers = vi.hoisted<
  Array<{
    isOverflowing: { value: boolean }
    checkOverflow: ReturnType<typeof vi.fn>
  }>
>(() => [])

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

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    isLoggedIn: { value: false },
    userEmail: { value: undefined }
  })
}))

const openFeedbackDialog = vi.hoisted(() => vi.fn())
const openWorkflow = vi.hoisted(() => vi.fn())
vi.mock('@/platform/support/feedbackDialog', () => ({
  openFeedbackDialog
}))

vi.mock('@/composables/useWorkflowStatusDismissal', () => ({
  useWorkflowStatusDismissal: vi.fn()
}))

vi.mock('@/composables/element/useOverflowObserver', async () => {
  const { ref } = await import('vue')
  return {
    useOverflowObserver: () => {
      const observer = {
        isOverflowing: ref(false),
        checkOverflow: vi.fn()
      }
      overflowObservers.push(observer)
      return observer
    }
  }
})

vi.mock('@/platform/workflow/core/services/workflowService', () => ({
  useWorkflowService: () => ({
    openWorkflow,
    closeWorkflow: vi.fn()
  })
}))

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
        type: Object as PropType<{ workflow: { filename?: string } }>,
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

beforeEach(() => {
  distribution.isCloud = false
  distribution.isDesktop = false
  distribution.isNightly = false
  useSettingStore().$patch({
    settingValues: { 'Comfy.UI.TabBarLayout': 'Default' }
  })
  useAgentPanelStore().isOpen = false
  overflowObservers.length = 0
})

describe('WorkflowTabs feedback button', () => {
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
    useSettingStore().settingValues['Comfy.UI.TabBarLayout'] = 'Legacy'
    renderComponent()
    expect(
      screen.queryByRole('button', { name: 'Feedback' })
    ).not.toBeInTheDocument()
  })
})

describe('WorkflowTabs agent entry button', () => {
  beforeEach(() => {
    useAgentPanelStore().enabled = true
  })

  it('does not render the entry button in the legacy tab bar even with the flag on', () => {
    useSettingStore().settingValues['Comfy.UI.TabBarLayout'] = 'Legacy'
    renderComponent()

    expect(
      screen.queryByRole('button', { name: enMessages.agent.askComfyAgent })
    ).toBeNull()
  })

  it('does not render the entry button while the feature flag is off', () => {
    useAgentPanelStore().enabled = false
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

    expect(useAgentPanelStore().toggle).toHaveBeenCalledTimes(1)
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })

  it('exposes the gate-settled signal on the actions container once the gate settles', async () => {
    renderComponent()

    const actions = screen.getByTestId('integrated-tab-bar-actions')
    expect(actions).not.toHaveAttribute('data-agent-gate-settled')

    useAgentPanelStore().gateSettled = true
    await nextTick()

    expect(actions).toHaveAttribute('data-agent-gate-settled', 'true')
  })
})

describe('WorkflowTabs selection and overflow', () => {
  let firstWorkflow: LoadedComfyWorkflow
  let secondWorkflow: LoadedComfyWorkflow

  beforeEach(async () => {
    const workflowStore = useWorkflowStore()
    firstWorkflow = await workflowStore
      .createTemporary('First workflow.json')
      .load()
    secondWorkflow = await workflowStore
      .createTemporary('Second workflow.json')
      .load()
    workflowStore.attachWorkflow(firstWorkflow, 0)
    workflowStore.attachWorkflow(secondWorkflow, 1)
    workflowStore.activeWorkflow = firstWorkflow
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

  it('keeps the real workflow selected when another workflow is not opened', async () => {
    openWorkflow.mockResolvedValueOnce(false)
    const { user } = renderComponent()
    const secondTab = screen.getByRole('button', { name: 'Second workflow' })

    await user.click(secondTab)

    expect(
      screen.getByRole('button', { name: 'First workflow' })
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: 'Second workflow' })
    ).toHaveAttribute('aria-pressed', 'false')
    expect(secondTab).toHaveFocus()
  })

  it('keeps overflow controls available when the tab strip overflows', async () => {
    renderComponent()
    await waitFor(() => expect(overflowObservers).toHaveLength(1))

    overflowObservers[0].isOverflowing.value = true
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
    const scrollIntoView = vi.spyOn(HTMLElement.prototype, 'scrollIntoView')
    renderComponent()

    useWorkflowStore().activeWorkflow = secondWorkflow

    await waitFor(() =>
      expect(scrollIntoView).toHaveBeenCalledWith({
        block: 'nearest',
        inline: 'nearest'
      })
    )
  })
})

describe('WorkflowTabs scrolling', () => {
  it('reveals the active tab when the tab list overflows', async () => {
    const workflowStore = useWorkflowStore()
    const workflow = await workflowStore.createTemporary('active.json').load()
    const scrollIntoView = vi.spyOn(HTMLElement.prototype, 'scrollIntoView')
    renderComponent()
    await waitFor(() => expect(overflowObservers).toHaveLength(1))
    workflowStore.attachWorkflow(workflow, 0)
    workflowStore.activeWorkflow = workflow
    await nextTick()

    overflowObservers[0].isOverflowing.value = true
    await nextTick()
    await nextTick()

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalledWith({
        block: 'nearest',
        inline: 'nearest'
      })
    })
  })

  it('does not reveal the active tab again when overflow remains true', async () => {
    const workflowStore = useWorkflowStore()
    const workflow = await workflowStore.createTemporary('active.json').load()
    const scrollIntoView = vi.spyOn(HTMLElement.prototype, 'scrollIntoView')
    const { unmount } = renderComponent()
    await waitFor(() => expect(overflowObservers).toHaveLength(1))
    workflowStore.attachWorkflow(workflow, 0)
    workflowStore.activeWorkflow = workflow
    await nextTick()

    overflowObservers[0].isOverflowing.value = true
    await nextTick()
    await nextTick()
    scrollIntoView.mockClear()

    overflowObservers[0].isOverflowing.value = true
    await nextTick()

    expect(scrollIntoView).not.toHaveBeenCalled()
    unmount()
  })
})
