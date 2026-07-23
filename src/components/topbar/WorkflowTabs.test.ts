import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  useCurrentUser: () => ({ isLoggedIn: { value: false } })
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

const workflowServiceMocks = vi.hoisted(() => ({
  openWorkflow: vi.fn(),
  closeWorkflow: vi.fn()
}))

vi.mock('@/platform/workflow/core/services/workflowService', () => ({
  useWorkflowService: () => workflowServiceMocks
}))

interface MockWorkflow {
  key: string
  path: string
  filename: string
}

interface MockWorkflowOption {
  value: string
  workflow: MockWorkflow
}

const workflowStoreState = vi.hoisted(() =>
  reactive({
    openWorkflows: [] as MockWorkflow[],
    activeWorkflow: null as MockWorkflow | null
  })
)

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => workflowStoreState
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({ execute: vi.fn() })
}))

vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: () => ({ shiftDown: false })
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
    props: ['workflowOption'],
    setup(props: { workflowOption: MockWorkflowOption }) {
      return () => h('span', props.workflowOption.workflow.filename)
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

function renderComponent() {
  const user = userEvent.setup()
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })

  const result = render(WorkflowTabs, {
    global: {
      plugins: [PrimeVue, i18n],
      directives: {
        tooltip: {}
      }
    }
  })

  return { user, ...result }
}

/** PrimeVue SelectButton renders toggle buttons with aria-pressed. */
function getToggleButtons(container: Element) {
  return container.querySelectorAll<HTMLElement>(  
    '[data-pc-name="pctogglebutton"]'
  )
}

function getToggleButtonByLabel(container: Element, label: string) {
  return Array.from(getToggleButtons(container)).find((button) =>
    button.textContent?.includes(label)
  )
}

describe('WorkflowTabs feedback button', () => {
  let openSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    distribution.isCloud = false
    distribution.isDesktop = false
    distribution.isNightly = false
    tabBarLayout.value = 'Default'
    workflowStoreState.openWorkflows = []
    workflowStoreState.activeWorkflow = null
    workflowServiceMocks.openWorkflow.mockReset()
    openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
  })

  afterEach(() => {
    openSpy.mockRestore()
  })

  it('opens the Typeform survey tagged with topbar source on Cloud', async () => {
    distribution.isCloud = true
    const { user } = renderComponent()

    await user.click(screen.getByRole('button', { name: 'Feedback' }))

    expect(openSpy).toHaveBeenCalledWith(
      'https://form.typeform.com/to/q7azbWPi#distribution=ccloud&source=topbar',
      '_blank',
      'noopener,noreferrer'
    )
  })

  it('opens the Typeform survey tagged with topbar source on Nightly', async () => {
    distribution.isNightly = true
    const { user } = renderComponent()

    await user.click(screen.getByRole('button', { name: 'Feedback' }))

    expect(openSpy).toHaveBeenCalledWith(
      'https://form.typeform.com/to/q7azbWPi#distribution=oss-nightly&source=topbar',
      '_blank',
      'noopener,noreferrer'
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

describe('WorkflowTabs cancelled workflow switch', () => {
  const workflowA: MockWorkflow = { key: 'a', path: 'a.json', filename: 'A' }
  const workflowB: MockWorkflow = { key: 'b', path: 'b.json', filename: 'B' }

  beforeEach(() => {
    distribution.isCloud = false
    distribution.isDesktop = false
    distribution.isNightly = false
    tabBarLayout.value = 'Default'
    workflowStoreState.openWorkflows = [workflowA, workflowB]
    workflowStoreState.activeWorkflow = workflowA
    workflowServiceMocks.openWorkflow.mockReset()
  })

  it('keeps the original tab selected when the user cancels the switch', async () => {
    workflowServiceMocks.openWorkflow.mockResolvedValue(false)
    const { user, container } = renderComponent()

    await user.click(screen.getByText('B'))

    expect(workflowServiceMocks.openWorkflow).toHaveBeenCalledWith(workflowB)
    await waitFor(() => {
      expect(getToggleButtonByLabel(container, 'A')).toHaveAttribute(
        'aria-pressed',
        'true'
      )
      expect(getToggleButtonByLabel(container, 'B')).toHaveAttribute(
        'aria-pressed',
        'false'
      )
    })
  })

  it('selects the clicked tab once the switch succeeds', async () => {
    workflowServiceMocks.openWorkflow.mockImplementation(async () => {
      workflowStoreState.activeWorkflow = workflowB
      return true
    })
    const { user, container } = renderComponent()

    await user.click(screen.getByText('B'))

    await waitFor(() =>
      expect(getToggleButtonByLabel(container, 'B')).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    )
  })
})
