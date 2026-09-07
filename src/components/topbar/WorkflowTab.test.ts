import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { markRaw, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { ComponentProps } from 'vue-component-type-helpers'

import type * as ExecutionStoreModule from '@/stores/executionStore'
import type { WorkflowExecutionStatus } from '@/stores/executionStore'

const { mockWorkflowStatus, mockCloseWorkflow } = await vi.hoisted(async () => {
  const { shallowRef } = await import('vue')
  return {
    mockWorkflowStatus: shallowRef<Map<object, WorkflowExecutionStatus>>(
      new Map()
    ),
    mockCloseWorkflow: vi.fn().mockResolvedValue(true)
  }
})

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    currentUser: null,
    isAuthenticated: false,
    isInitialized: true
  })
}))

vi.mock('@/stores/executionStore', async (importOriginal) => {
  const actual = await importOriginal<typeof ExecutionStoreModule>()
  return {
    WORKFLOW_STATUS_I18N_KEYS: actual.WORKFLOW_STATUS_I18N_KEYS,
    useExecutionStore: () => ({
      getWorkflowStatus(workflow: object | undefined | null) {
        if (!workflow) return undefined
        return mockWorkflowStatus.value.get(workflow)
      }
    })
  }
})

vi.mock('@/composables/usePragmaticDragAndDrop', () => ({
  usePragmaticDraggable: vi.fn(),
  usePragmaticDroppable: vi.fn()
}))

vi.mock('@/composables/useWorkflowActionsMenu', () => ({
  useWorkflowActionsMenu: () => ({
    menuItems: { value: [] }
  })
}))

vi.mock('@/platform/workflow/core/services/workflowService', () => ({
  useWorkflowService: () => ({
    closeWorkflow: mockCloseWorkflow
  })
}))

vi.mock('@/renderer/core/thumbnail/useWorkflowThumbnail', () => ({
  useWorkflowThumbnail: () => ({
    getThumbnail: vi.fn(() => null)
  })
}))

vi.mock('./WorkflowTabPopover.vue', () => ({
  default: {
    render: () => null,
    methods: {
      showPopover: () => {},
      hidePopover: () => {},
      togglePopover: () => {}
    }
  }
}))

import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'

import WorkflowTab from './WorkflowTab.vue'

type WorkflowTabProps = ComponentProps<typeof WorkflowTab>

const statusAriaLabels: Record<WorkflowExecutionStatus, string> = {
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed'
}

const agentAriaLabels = {
  agentWorking: 'Agent is working on this workflow',
  agentModified: 'Agent updated this workflow'
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { close: 'Close', ...statusAriaLabels, ...agentAriaLabels }
    }
  }
})

type WorkflowOption = WorkflowTabProps['workflowOption']
type Workflow = WorkflowOption['workflow']
type WorkflowOverrides = Partial<Workflow>

function makeWorkflowOption(overrides: WorkflowOverrides = {}): WorkflowOption {
  const workflow = fromPartial<Workflow>({
    key: 'test-key',
    path: '/workflows/test.json',
    filename: 'test.json',
    isPersisted: true,
    isModified: false,
    activeMode: 'graph',
    changeTracker: null,
    ...overrides
  })
  // markRaw keeps a stable identity through prop reactivity so the store's
  // identity-based status lookup resolves against the same object.
  return { value: 'test-key', workflow: markRaw(workflow) }
}

function renderTab({
  workflowOption = makeWorkflowOption(),
  activeWorkflowKey = 'other-key',
  activeWorkflowPath
}: {
  workflowOption?: WorkflowOption
  activeWorkflowKey?: string
  activeWorkflowPath?: string
} = {}) {
  const resolvedActiveWorkflowPath =
    activeWorkflowPath ??
    (activeWorkflowKey === workflowOption.workflow.key
      ? workflowOption.workflow.path
      : '/workflows/other.json')

  return render(WorkflowTab, {
    global: {
      plugins: [
        createTestingPinia({
          stubActions: false,
          initialState: {
            workspace: { shiftDown: false },
            workflow: {
              activeWorkflow: {
                key: activeWorkflowKey,
                path: resolvedActiveWorkflowPath
              }
            },
            setting: { settingValues: { 'Comfy.Workflow.AutoSave': 'off' } }
          }
        }),
        i18n
      ],
      stubs: {
        WorkflowActionsList: true,
        Button: {
          template: '<button v-bind="$attrs"><slot /></button>'
        }
      }
    },
    props: {
      workflowOption,
      isFirst: false,
      isLast: false
    }
  })
}

describe('WorkflowTab - workflow status indicator', () => {
  beforeEach(() => {
    mockWorkflowStatus.value = new Map()
  })

  it.for(['running', 'completed', 'failed'] as const)(
    'labels the %s indicator with a translated status name',
    (status) => {
      const workflowOption = makeWorkflowOption()
      mockWorkflowStatus.value = new Map([[workflowOption.workflow, status]])

      renderTab({ workflowOption })
      expect(
        screen.getByRole('img', { name: statusAriaLabels[status] })
      ).toBeTruthy()
    }
  )

  it('does not badge the active tab with its own status', () => {
    const workflowOption = makeWorkflowOption()
    mockWorkflowStatus.value = new Map([[workflowOption.workflow, 'running']])

    renderTab({ workflowOption, activeWorkflowKey: 'test-key' })
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('shows unsaved dot when no workflow status and workflow is unsaved', () => {
    renderTab({ workflowOption: makeWorkflowOption({ isPersisted: false }) })

    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByTestId('workflow-dirty-indicator')).toHaveClass(
      'bg-smoke-800'
    )
  })

  it('keeps an unsaved inactive tab dot muted when workflow keys collide', () => {
    renderTab({
      workflowOption: makeWorkflowOption({ isPersisted: false }),
      activeWorkflowKey: 'test-key',
      activeWorkflowPath: '/workflows/other.json'
    })

    expect(screen.getByTestId('workflow-dirty-indicator')).toHaveClass(
      'bg-smoke-800'
    )
  })

  it('shows the unsaved dot when modified and autosave is off', () => {
    renderTab({ workflowOption: makeWorkflowOption({ isModified: true }) })

    expect(screen.getByTestId('workflow-dirty-indicator')).toHaveClass(
      'rounded-full'
    )
  })

  it('workflow status replaces the unsaved dot', () => {
    const workflowOption = makeWorkflowOption({ isPersisted: false })
    mockWorkflowStatus.value = new Map([[workflowOption.workflow, 'running']])

    renderTab({ workflowOption })
    expect(
      screen.getByRole('img', { name: statusAriaLabels.running })
    ).toBeTruthy()
    expect(screen.queryByTestId('workflow-dirty-indicator')).toBeNull()
  })
})

describe('WorkflowTab - agent activity indicators', () => {
  beforeEach(() => {
    mockWorkflowStatus.value = new Map()
  })

  it('T-17 / PM-658 / FE-1289 renders the active workflow tab loading state', async () => {
    renderTab({ activeWorkflowKey: 'test-key' })
    useWorkflowTabActivityStore().setEditing('/workflows/test.json')
    await nextTick()

    expect(
      screen.getByRole('img', { name: agentAriaLabels.agentWorking })
    ).toBeTruthy()
  })

  it('the agent spinner wins over the unseen-changes dot', async () => {
    renderTab()
    const activity = useWorkflowTabActivityStore()
    activity.setEditing('/workflows/test.json')
    activity.markModified('/workflows/test.json')
    await nextTick()

    expect(
      screen.getByRole('img', { name: agentAriaLabels.agentWorking })
    ).toBeTruthy()
    expect(screen.queryByTestId('agent-modified-indicator')).toBeNull()
  })

  it('shows the unseen-changes dot ahead of non-failed execution status', async () => {
    const workflowOption = makeWorkflowOption()
    mockWorkflowStatus.value = new Map([[workflowOption.workflow, 'running']])
    renderTab({ workflowOption })
    useWorkflowTabActivityStore().markModified('/workflows/test.json')
    await nextTick()

    expect(screen.getByTestId('agent-modified-indicator')).toHaveClass(
      'size-2',
      'bg-primary-background'
    )
    expect(
      screen.queryByRole('img', { name: statusAriaLabels.running })
    ).toBeNull()
  })

  it('a failed run outranks the unseen-changes dot', async () => {
    const workflowOption = makeWorkflowOption()
    mockWorkflowStatus.value = new Map([[workflowOption.workflow, 'failed']])
    renderTab({ workflowOption })
    useWorkflowTabActivityStore().markModified('/workflows/test.json')
    await nextTick()

    expect(
      screen.getByRole('img', { name: statusAriaLabels.failed })
    ).toBeTruthy()
    expect(screen.queryByTestId('agent-modified-indicator')).toBeNull()
  })

  it('clearing the store restores the existing indicators', async () => {
    renderTab({ workflowOption: makeWorkflowOption({ isPersisted: false }) })
    const activity = useWorkflowTabActivityStore()
    activity.markModified('/workflows/test.json')
    await nextTick()
    expect(screen.queryByTestId('workflow-dirty-indicator')).toBeNull()

    activity.markSeen('/workflows/test.json')
    await nextTick()
    expect(screen.getByTestId('workflow-dirty-indicator')).toBeTruthy()
    expect(screen.queryByTestId('agent-modified-indicator')).toBeNull()
  })
})

describe('WorkflowTab - close button', () => {
  it('delegates close to workflow service with the tab workflow', async () => {
    renderTab()
    const user = userEvent.setup()
    await user.click(screen.getByTestId('close-workflow-button'))

    expect(mockCloseWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'test-key' }),
      expect.anything()
    )
  })
})
