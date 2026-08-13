import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive } from 'vue'
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
vi.mock('@/platform/support/feedbackDialog', () => ({
  openFeedbackDialog
}))

vi.mock('@/composables/useWorkflowStatusDismissal', () => ({
  useWorkflowStatusDismissal: vi.fn()
}))

vi.mock('@/composables/element/useOverflowObserver', async () => {
  const { ref } = await import('vue')

  return {
    useOverflowObserver: () => ({
      isOverflowing: ref(true),
      disposed: ref(false),
      checkOverflow: vi.fn(),
      dispose: vi.fn()
    })
  }
})

vi.mock('@vueuse/core', async () => {
  const { reactive } = await import('vue')

  return {
    useScroll: () => ({
      arrivedState: reactive({ left: true, right: false }),
      measure: vi.fn()
    })
  }
})

vi.mock('primevue/scrollpanel', async () => {
  const { defineComponent, h } = await import('vue')

  return {
    default: defineComponent({
      name: 'ScrollPanelStub',
      setup(_props, { slots }) {
        return () =>
          h(
            'div',
            {
              class: 'p-scrollpanel-content',
              'data-testid': 'workflow-tabs-scroll-content'
            },
            slots.default?.()
          )
      }
    })
  }
})

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

const whileMouseDown = vi.hoisted(() => vi.fn())
vi.mock('@/utils/mouseDownUtil', () => ({ whileMouseDown }))

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

describe('WorkflowTabs overflow arrows', () => {
  beforeEach(() => {
    whileMouseDown.mockClear()
  })

  it('scrolls once immediately and delays hold-to-repeat scrolling', async () => {
    const { user } = renderComponent()

    const scrollContent = screen.getByTestId('workflow-tabs-scroll-content')

    const scrollBy = vi.fn()
    Object.defineProperty(scrollContent, 'scrollBy', {
      configurable: true,
      value: scrollBy
    })

    const rightArrow = await screen.findByRole('button', {
      name: /scroll right/i
    })
    await user.click(rightArrow)

    expect(scrollBy).toHaveBeenCalledOnce()
    expect(scrollBy).toHaveBeenCalledWith({ left: 20 })
    expect(whileMouseDown).toHaveBeenCalledOnce()
    expect(whileMouseDown).toHaveBeenCalledWith(
      expect.any(PointerEvent),
      expect.any(Function),
      30,
      300
    )

    const repeatScroll = whileMouseDown.mock.calls[0][1]
    repeatScroll()

    expect(scrollBy).toHaveBeenCalledTimes(2)
  })

  it('scrolls once when activated from the keyboard', async () => {
    const { user } = renderComponent()

    const scrollContent = screen.getByTestId('workflow-tabs-scroll-content')
    const scrollBy = vi.fn()
    Object.defineProperty(scrollContent, 'scrollBy', {
      configurable: true,
      value: scrollBy
    })

    const rightArrow = await screen.findByRole('button', {
      name: /scroll right/i
    })
    rightArrow.focus()
    await user.keyboard('{Enter}')

    expect(scrollBy).toHaveBeenCalledOnce()
    expect(scrollBy).toHaveBeenCalledWith({ left: 20 })
    expect(whileMouseDown).not.toHaveBeenCalled()
  })
})
