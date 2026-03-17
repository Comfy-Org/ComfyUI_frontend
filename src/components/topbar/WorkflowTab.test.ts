import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { nextTick, reactive } from 'vue'

import type { ComponentProps } from 'vue-component-type-helpers'

import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import type { WorkflowStatus } from '@/stores/executionStore'

vi.mock('@/stores/firebaseAuthStore', () => ({
  useFirebaseAuthStore: () => ({
    currentUser: null,
    isAuthenticated: false,
    isLoading: false
  })
}))

const mockExecutionStore = reactive({
  workflowStatus: new Map<string, WorkflowStatus>(),
  clearWorkflowStatus: vi.fn()
})

vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: () => mockExecutionStore
}))

vi.mock('reka-ui', () => {
  const passthrough = {
    render() {
      return (
        this as unknown as { $slots: { default?: () => unknown } }
      ).$slots.default?.()
    }
  }
  return {
    ContextMenuRoot: passthrough,
    ContextMenuTrigger: passthrough,
    ContextMenuContent: passthrough,
    ContextMenuItem: passthrough,
    ContextMenuPortal: passthrough,
    ContextMenuSeparator: passthrough,
    Primitive: passthrough
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
    closeWorkflow: vi.fn()
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
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

type WorkflowTabProps = ComponentProps<typeof WorkflowTab>

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { close: 'Close' } } }
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
        WorkflowActionsList: true
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
    mockExecutionStore.workflowStatus = new Map()
    mockExecutionStore.clearWorkflowStatus.mockClear()
  })

  it.for(['running', 'completed', 'failed'] as const)(
    'shows %s indicator from store',
    (status) => {
      mockExecutionStore.workflowStatus = new Map([
        ['/workflows/test.json', status]
      ])

      const wrapper = mountTab()
      const indicator = findIndicator(wrapper)
      expect(indicator.exists()).toBe(true)
      expect(indicator.attributes('data-state')).toBe(status)
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
    mockExecutionStore.workflowStatus = new Map([
      ['/workflows/test.json', 'completed']
    ])

    const wrapper = mountTab({ activeWorkflowKey: 'test-key' })
    expect(findIndicator(wrapper).exists()).toBe(false)
  })

  it('job state replaces unsaved dot', () => {
    mockExecutionStore.workflowStatus = new Map([
      ['/workflows/test.json', 'running']
    ])

    const wrapper = mountTab({
      workflowOverrides: { isPersisted: false }
    })
    const indicator = findIndicator(wrapper)
    expect(indicator.exists()).toBe(true)
    expect(indicator.attributes('data-state')).toBe('running')
  })

  it('clears workflow status when tab becomes active', async () => {
    mockExecutionStore.workflowStatus = new Map([
      ['/workflows/test.json', 'completed']
    ])

    const wrapper = mountTab()
    expect(findIndicator(wrapper).exists()).toBe(true)

    const workflowStore = useWorkflowStore()
    workflowStore.activeWorkflow = {
      key: 'test-key'
    } satisfies Partial<LoadedComfyWorkflow> as LoadedComfyWorkflow
    await nextTick()

    expect(mockExecutionStore.clearWorkflowStatus).toHaveBeenCalledWith(
      '/workflows/test.json'
    )
  })
})
