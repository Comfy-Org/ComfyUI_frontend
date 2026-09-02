import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
const overflowObservers = vi.hoisted<
  Array<{
    isOverflowing: { value: boolean }
    checkOverflow: ReturnType<typeof vi.fn>
  }>
>(() => [])
interface WorkflowFixture {
  path: string
}
const workflowStoreHolder = vi.hoisted<{
  store: {
    openWorkflows: WorkflowFixture[]
    activeWorkflow: WorkflowFixture | null
  } | null
}>(() => ({ store: null }))

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

vi.mock('primevue/scrollpanel', async () => {
  const { defineComponent, h, ref } = await import('vue')
  return {
    default: defineComponent({
      name: 'ScrollPanelStub',
      inheritAttrs: false,
      setup(_, { attrs, slots }) {
        const contentKey = ref(0)
        return () => {
          const contentProps = attrs['pt:content']
          const passThroughProps =
            typeof contentProps === 'object' && contentProps !== null
              ? contentProps
              : {}

          return h('div', [
            h(
              'button',
              { onClick: () => contentKey.value++ },
              'Replace scroll content'
            ),
            h(
              'div',
              {
                ...passThroughProps,
                key: contentKey.value,
                class: 'p-scrollpanel-content',
                'data-testid': 'scroll-content',
                'data-internal-ref-preserved':
                  'ref' in passThroughProps ? undefined : 'true'
              },
              slots.default?.()
            )
          ])
        }
      }
    })
  }
})

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

vi.mock('@/composables/useWorkflowStatusDismissal', () => ({
  useWorkflowStatusDismissal: vi.fn()
}))

vi.mock('@/composables/element/useOverflowObserver', async () => {
  const { ref } = await import('vue')
  return {
    useOverflowObserver: () => {
      const isOverflowing = ref(false)
      const observer = {
        isOverflowing,
        checkOverflow: vi.fn()
      }
      overflowObservers.push(observer)
      return observer
    }
  }
})

vi.mock('@/platform/workflow/core/services/workflowService', () => ({
  useWorkflowService: () => ({
    openWorkflow: vi.fn(),
    closeWorkflow: vi.fn()
  })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => {
    const store = reactive<{
      openWorkflows: WorkflowFixture[]
      activeWorkflow: WorkflowFixture | null
    }>({
      openWorkflows: [],
      activeWorkflow: null
    })
    workflowStoreHolder.store = store
    return store
  }
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

describe('WorkflowTabs scrolling', () => {
  beforeEach(() => {
    overflowObservers.length = 0
  })

  it('does not overwrite the ScrollPanel content ref', async () => {
    renderComponent()

    await waitFor(() => expect(overflowObservers).toHaveLength(1))

    expect(screen.getByTestId('scroll-content')).toHaveAttribute(
      'data-internal-ref-preserved',
      'true'
    )
  })

  it('rebinds scroll listeners when scroll content is replaced', async () => {
    const { user, unmount } = renderComponent()
    await waitFor(() => expect(overflowObservers).toHaveLength(1))
    const oldScrollContent = screen.getByTestId('scroll-content')
    const removeOldListener = vi.spyOn(oldScrollContent, 'removeEventListener')

    await user.click(
      screen.getByRole('button', { name: 'Replace scroll content' })
    )

    await waitFor(() => {
      expect(removeOldListener).toHaveBeenCalledWith(
        'scroll',
        expect.any(Function),
        expect.any(Object)
      )
    })
    expect(removeOldListener).toHaveBeenCalledWith(
      'scrollend',
      expect.any(Function),
      expect.any(Object)
    )

    const newScrollContent = screen.getByTestId('scroll-content')
    const removeNewListener = vi.spyOn(newScrollContent, 'removeEventListener')
    unmount()

    expect(removeNewListener).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function),
      expect.any(Object)
    )
    expect(removeNewListener).toHaveBeenCalledWith(
      'scrollend',
      expect.any(Function),
      expect.any(Object)
    )
  })

  it('reveals the active tab when overflowing scroll content is replaced', async () => {
    const workflow = { path: 'active.json' }
    const scrollIntoView = vi.spyOn(HTMLElement.prototype, 'scrollIntoView')
    const { user } = renderComponent()
    await waitFor(() => expect(overflowObservers).toHaveLength(1))
    if (!workflowStoreHolder.store)
      throw new Error('Workflow store not mounted')
    workflowStoreHolder.store.openWorkflows = [workflow]
    workflowStoreHolder.store.activeWorkflow = workflow
    await nextTick()

    overflowObservers[0].isOverflowing.value = true
    await nextTick()
    await nextTick()
    scrollIntoView.mockClear()

    await user.click(
      screen.getByRole('button', { name: 'Replace scroll content' })
    )

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalledWith({
        block: 'nearest',
        inline: 'nearest'
      })
    })
  })

  it('does not reveal the active tab again when overflow remains true', async () => {
    const workflow = { path: 'active.json' }
    const scrollIntoView = vi.spyOn(HTMLElement.prototype, 'scrollIntoView')
    const { unmount } = renderComponent()
    await waitFor(() => expect(overflowObservers).toHaveLength(1))
    if (!workflowStoreHolder.store)
      throw new Error('Workflow store not mounted')
    workflowStoreHolder.store.openWorkflows = [workflow]
    workflowStoreHolder.store.activeWorkflow = workflow
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
