import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
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
  default: { render: () => null }
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

function mountTab({
  workflowOverrides = {},
  activeWorkflowKey = 'other-key'
} = {}) {
  return mount(WorkflowTab, {
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

function findIndicator(wrapper: ReturnType<typeof mountTab>) {
  return wrapper.find('[data-testid="job-state-indicator"]')
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

      const wrapper = mountTab()
      const indicator = findIndicator(wrapper)
      expect(indicator.exists()).toBe(true)
      expect(indicator.attributes('data-state')).toBe(status)
      expect(indicator.attributes('role')).toBe('status')
      expect(indicator.attributes('aria-label')).toBe(statusAriaLabels[status])
    }
  )

  it('shows unsaved dot when no job state and workflow is unsaved', () => {
    const wrapper = mountTab({
      workflowOverrides: { isPersisted: false }
    })
    expect(findIndicator(wrapper).exists()).toBe(false)
    const dot = wrapper.find('[data-testid="unsaved-indicator"]')
    expect(dot.exists()).toBe(true)
    expect(dot.text()).toBe('•')
  })

  it('does not show job indicator on active tab', () => {
    mockWorkflowStatus.value = new Map([['/workflows/test.json', 'completed']])

    const wrapper = mountTab({ activeWorkflowKey: 'test-key' })
    expect(findIndicator(wrapper).exists()).toBe(false)
  })

  it('job state replaces unsaved dot', () => {
    mockWorkflowStatus.value = new Map([['/workflows/test.json', 'running']])

    const wrapper = mountTab({
      workflowOverrides: { isPersisted: false }
    })
    const indicator = findIndicator(wrapper)
    expect(indicator.exists()).toBe(true)
    expect(indicator.attributes('data-state')).toBe('running')
  })

  it('delegates close to workflow service with the tab workflow', async () => {
    const wrapper = mountTab()
    await wrapper.find('button[aria-label="Close"]').trigger('click')

    expect(mockCloseWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'test-key' }),
      expect.anything()
    )
  })
})
