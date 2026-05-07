import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { ComponentProps } from 'vue-component-type-helpers'

import type { WorkflowStatus } from '@/stores/executionStore'

const { mockWorkflowStatus, mockCloseWorkflow } = await vi.hoisted(async () => {
  const { shallowRef } = await import('vue')
  return {
    mockWorkflowStatus: shallowRef<Map<string, WorkflowStatus>>(new Map()),
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

vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: () => ({
    get workflowStatus() {
      return mockWorkflowStatus.value
    }
  })
}))

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

const statusAriaLabels: Record<WorkflowStatus, string> = {
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

function makeWorkflowOption(overrides: Record<string, unknown> = {}) {
  return {
    value: 'test-key',
    workflow: {
      key: 'test-key',
      path: '/workflows/test.json',
      filename: 'test.json',
      isPersisted: true,
      isModified: false,
      initialMode: 'default',
      activeMode: 'default',
      changeTracker: null,
      ...overrides
    }
  } as unknown as WorkflowTabProps['workflowOption']
}

function renderTab({
  workflowOverrides = {},
  activeWorkflowKey = 'other-key'
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
            setting: {}
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
      workflowOption: makeWorkflowOption(workflowOverrides),
      isFirst: false,
      isLast: false
    }
  })
}

describe('WorkflowTab - job state indicator', () => {
  beforeEach(() => {
    mockWorkflowStatus.value = new Map()
    mockCloseWorkflow.mockClear()
  })

  it.for(['running', 'completed', 'failed'] as const)(
    'shows %s indicator from store with translated aria-label',
    (status) => {
      mockWorkflowStatus.value = new Map([['/workflows/test.json', status]])

      renderTab()
      const indicator = screen.getByTestId('job-state-indicator')
      expect(indicator.getAttribute('data-state')).toBe(status)
      expect(indicator.getAttribute('role')).toBe('status')
      expect(indicator.getAttribute('aria-label')).toBe(
        statusAriaLabels[status]
      )
    }
  )

  it('shows unsaved dot when no job state and workflow is unsaved', () => {
    renderTab({ workflowOverrides: { isPersisted: false } })

    expect(screen.queryByTestId('job-state-indicator')).toBeNull()
    const dot = screen.getByTestId('unsaved-indicator')
    expect(dot.textContent).toBe('•')
  })

  it('does not show job indicator on active tab', () => {
    mockWorkflowStatus.value = new Map([['/workflows/test.json', 'completed']])

    renderTab({ activeWorkflowKey: 'test-key' })
    expect(screen.queryByTestId('job-state-indicator')).toBeNull()
  })

  it('job state replaces unsaved dot', () => {
    mockWorkflowStatus.value = new Map([['/workflows/test.json', 'running']])

    renderTab({ workflowOverrides: { isPersisted: false } })
    const indicator = screen.getByTestId('job-state-indicator')
    expect(indicator.getAttribute('data-state')).toBe('running')
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
})
