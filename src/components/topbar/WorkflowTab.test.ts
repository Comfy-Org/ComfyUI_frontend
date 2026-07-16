import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { markRaw } from 'vue'
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

vi.mock('@/stores/firebaseAuthStore', () => ({
  useFirebaseAuthStore: () => ({
    currentUser: null,
    isAuthenticated: false,
    isLoading: false
  })
}))

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

import WorkflowTab from './WorkflowTab.vue'

type WorkflowTabProps = ComponentProps<typeof WorkflowTab>

const statusAriaLabels: Record<WorkflowExecutionStatus, string> = {
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed'
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { close: 'Close', ...statusAriaLabels }
    }
  }
})

type WorkflowOption = WorkflowTabProps['workflowOption']
type Workflow = WorkflowOption['workflow']
type WorkflowOverrides = Partial<Workflow>

// ComfyWorkflow has many required fields the component never reads (file
// IO, change tracking). Validate the fields we *do* set against the real
// type via Partial<Workflow>, then cast — adding/renaming a read field in
// the component will fail typecheck on the override map.
function makeWorkflowOption(overrides: WorkflowOverrides = {}): WorkflowOption {
  const workflow = {
    key: 'test-key',
    path: '/workflows/test.json',
    filename: 'test.json',
    isPersisted: true,
    isModified: false,
    activeMode: 'graph',
    changeTracker: null,
    ...overrides
  } satisfies WorkflowOverrides
  // markRaw keeps a stable identity through prop reactivity so the store's
  // identity-based status lookup resolves against the same object.
  return { value: 'test-key', workflow: markRaw(workflow) as Workflow }
}

function renderTab({
  workflowOption = makeWorkflowOption(),
  activeWorkflowKey = 'other-key'
}: {
  workflowOption?: WorkflowOption
  activeWorkflowKey?: string
} = {}) {
  return render(WorkflowTab, {
    global: {
      plugins: [
        createTestingPinia({
          stubActions: false,
          initialState: {
            workspace: { shiftDown: false },
            workflow: {
              activeWorkflow: { key: activeWorkflowKey }
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
    expect(screen.getByTestId('workflow-dirty-indicator').textContent).toBe('•')
  })

  it('shows the unsaved dot when modified and autosave is off', () => {
    renderTab({ workflowOption: makeWorkflowOption({ isModified: true }) })

    expect(screen.getByTestId('workflow-dirty-indicator').textContent).toBe('•')
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

describe('WorkflowTab - close button', () => {
  beforeEach(() => {
    mockCloseWorkflow.mockClear()
  })

  it('delegates close to workflow service with the tab workflow', async () => {
    renderTab()
    const user = userEvent.setup()
    await user.click(screen.getByTestId('close-workflow-button'))

    expect(mockCloseWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'test-key' }),
      expect.anything()
    )
  })

  // The active tab now only reveals its close button on hover (it used to be
  // shown while selected); closing the active tab must still work.
  it('still closes the active tab', async () => {
    renderTab({ activeWorkflowKey: 'test-key' })
    const user = userEvent.setup()
    await user.click(screen.getByTestId('close-workflow-button'))

    expect(mockCloseWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'test-key' }),
      expect.anything()
    )
  })
})
