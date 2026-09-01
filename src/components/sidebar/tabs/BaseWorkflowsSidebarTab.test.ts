import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { nextTick, reactive, ref, watchEffect } from 'vue'

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import type { TreeExplorerNode } from '@/types/treeExplorerTypes'
import { flattenTree } from '@/utils/treeUtil'

import BaseWorkflowsSidebarTab from '@/components/sidebar/tabs/BaseWorkflowsSidebarTab.vue'

const {
  setSearchQuery,
  emitSearch,
  captureSearchRoot,
  getSearchRoot,
  resetCapturedSearchRoot,
  mockExpandNode,
  mockToggleNodeOnEvent,
  mockLoadBookmarks,
  mockWorkflowService,
  mockWorkflowStoreState,
  registerSearchHandlers
} = vi.hoisted(() => {
  let updateQuery = (_query: string) => {}
  let triggerSearch = (_query: string) => {}
  let capturedSearchRoot: TreeExplorerNode<ComfyWorkflow> | null = null

  const workflowStore = {
    workflows: [] as ComfyWorkflow[],
    persistedWorkflows: [] as ComfyWorkflow[],
    bookmarkedWorkflows: [] as ComfyWorkflow[],
    openWorkflows: [] as ComfyWorkflow[],
    activeWorkflow: null as ComfyWorkflow | null,
    syncWorkflows: vi.fn().mockResolvedValue(undefined)
  }

  return {
    setSearchQuery: (query: string) => {
      updateQuery(query)
    },
    emitSearch: (query: string) => {
      triggerSearch(query)
    },
    captureSearchRoot: (root: TreeExplorerNode<ComfyWorkflow>) => {
      capturedSearchRoot = root
    },
    getSearchRoot: () => capturedSearchRoot,
    resetCapturedSearchRoot: () => {
      capturedSearchRoot = null
    },
    mockExpandNode: vi.fn(),
    mockToggleNodeOnEvent: vi.fn(),
    mockLoadBookmarks: vi.fn().mockResolvedValue(undefined),
    mockWorkflowService: {
      openWorkflow: vi.fn().mockResolvedValue(undefined),
      closeWorkflow: vi.fn().mockResolvedValue(undefined),
      renameWorkflow: vi.fn().mockResolvedValue(undefined),
      deleteWorkflow: vi.fn().mockResolvedValue(undefined),
      insertWorkflow: vi.fn().mockResolvedValue(undefined),
      duplicateWorkflow: vi.fn().mockResolvedValue(undefined)
    },
    mockWorkflowStoreState: workflowStore,
    registerSearchHandlers: (
      updateHandler: (query: string) => void,
      searchHandler: (query: string) => void
    ) => {
      updateQuery = updateHandler
      triggerSearch = searchHandler
    }
  }
})

const mockWorkflowStore = reactive(mockWorkflowStoreState)

vi.mock('@/components/common/NoResultsPlaceholder.vue', () => ({
  default: { name: 'NoResultsPlaceholder', template: '<div />' }
}))

vi.mock('@/components/ui/search-input/SearchInput.vue', () => ({
  default: {
    name: 'SearchInput',
    template: '<div data-testid="search-input" />',
    props: ['modelValue', 'placeholder'],
    setup(
      _props: { modelValue: string; placeholder?: string },
      {
        emit,
        expose
      }: {
        emit: (event: 'update:modelValue' | 'search', value: string) => void
        expose: (value: { focus: () => void }) => void
      }
    ) {
      const focus = vi.fn()
      expose({ focus })
      registerSearchHandlers(
        (query: string) => emit('update:modelValue', query),
        (query: string) => emit('search', query)
      )
      return {}
    }
  }
}))

vi.mock('@/components/sidebar/tabs/SidebarTopArea.vue', () => ({
  default: { name: 'SidebarTopArea', template: '<div><slot /></div>' }
}))

vi.mock('@/components/common/TextDivider.vue', () => ({
  default: { name: 'TextDivider', template: '<div />' }
}))

vi.mock('@/components/common/TreeExplorer.vue', () => ({
  default: {
    name: 'TreeExplorer',
    template: '<div data-testid="tree-explorer" />',
    props: ['root', 'selectionKeys', 'expandedKeys'],
    setup(props: {
      root: TreeExplorerNode<ComfyWorkflow>
      selectionKeys?: Record<string, boolean>
    }) {
      watchEffect(() => {
        if (props.selectionKeys === undefined) {
          captureSearchRoot(props.root)
        }
      })
    }
  }
}))

vi.mock('@/components/common/TreeExplorerTreeNode.vue', () => ({
  default: {
    name: 'TreeExplorerTreeNode',
    template:
      '<div><slot name="before-label" :node="node" /><slot /><slot name="actions" :node="node" /></div>',
    props: ['node']
  }
}))

vi.mock('@/components/sidebar/tabs/SidebarTabTemplate.vue', () => ({
  default: {
    name: 'SidebarTabTemplate',
    template:
      '<div><slot name="alt-title" /><slot name="tool-buttons" /><slot name="header" /><slot name="body" /></div>'
  }
}))

vi.mock('@/components/sidebar/tabs/workflows/WorkflowTreeLeaf.vue', () => ({
  default: { name: 'WorkflowTreeLeaf', template: '<div />', props: ['node'] }
}))

vi.mock('@/components/ui/button/Button.vue', () => ({
  default: { name: 'Button', template: '<button><slot /></button>' }
}))

vi.mock('@/composables/useTreeExpansion', () => ({
  useTreeExpansion: () => ({
    expandNode: mockExpandNode,
    toggleNodeOnEvent: mockToggleNodeOnEvent
  })
}))

vi.mock('@/composables/useAppMode', () => ({
  useAppMode: () => ({ isAppMode: ref(false) })
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: vi.fn((key: string) => {
      if (key === 'Comfy.Workflow.WorkflowTabsPosition') return 'Sidebar'
      return undefined
    })
  })
}))

vi.mock('@/platform/workflow/core/services/workflowService', () => ({
  useWorkflowService: () => mockWorkflowService
}))

vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: () => ({ shiftDown: false })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => mockWorkflowStore,
  useWorkflowBookmarkStore: () => ({ loadBookmarks: mockLoadBookmarks }),
  ComfyWorkflow: class {
    static basePath = 'workflows/'
  }
}))

vi.mock('primevue/confirmdialog', () => ({
  default: { name: 'ConfirmDialog', template: '<div />' }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
})

const createMockWorkflow = (path: string) =>
  fromPartial<ComfyWorkflow>({
    path,
    key: path.replace('workflows/', ''),
    isModified: false,
    isPersisted: true,
    isTemporary: false,
    suffix: 'json',
    directory: 'workflows'
  })

const getLeafPaths = (
  root: TreeExplorerNode<ComfyWorkflow> | null
): string[] => {
  if (!root) return []
  return flattenTree<ComfyWorkflow>(root)
    .map((w) => w.path)
    .sort()
}

describe('BaseWorkflowsSidebarTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetCapturedSearchRoot()

    mockWorkflowStore.workflows = []
    mockWorkflowStore.persistedWorkflows = []
    mockWorkflowStore.bookmarkedWorkflows = []
    mockWorkflowStore.openWorkflows = []
    mockWorkflowStore.activeWorkflow = null
  })

  const renderComponent = () =>
    render(BaseWorkflowsSidebarTab, {
      props: {
        title: 'Workflows',
        searchSubject: 'Workflow',
        dataTestid: 'workflows-sidebar'
      },
      global: {
        plugins: [createTestingPinia({ stubActions: false }), i18n],
        stubs: { teleport: true }
      }
    })

  it('returns an empty filtered workflow set when searchQuery is empty', async () => {
    mockWorkflowStore.workflows = [
      createMockWorkflow('workflows/test-alpha.json'),
      createMockWorkflow('workflows/test-beta.json')
    ]

    renderComponent()
    emitSearch('alpha')
    await nextTick()

    expect(mockExpandNode).toHaveBeenCalledTimes(1)
    const expandedRoot = mockExpandNode.mock.calls[0]?.[0] as
      | TreeExplorerNode<ComfyWorkflow>
      | undefined
    expect(getLeafPaths(expandedRoot ?? null)).toHaveLength(0)
  })

  it('filters workflows by case-insensitive path match', async () => {
    mockWorkflowStore.workflows = [
      createMockWorkflow('workflows/test-alpha.json'),
      createMockWorkflow('workflows/other-workflow.json'),
      createMockWorkflow('workflows/TEST-gamma.json')
    ]

    renderComponent()

    setSearchQuery('ALPHA')
    await nextTick()

    expect(getLeafPaths(getSearchRoot())).toEqual(['workflows/test-alpha.json'])
  })

  it('reactively updates filtered workflows when a workflow is removed', async () => {
    mockWorkflowStore.workflows = [
      createMockWorkflow('workflows/test-alpha.json'),
      createMockWorkflow('workflows/TEST-alpha-2.json'),
      createMockWorkflow('workflows/test-beta.json')
    ]

    renderComponent()

    setSearchQuery('alpha')
    await nextTick()
    expect(getLeafPaths(getSearchRoot())).toEqual([
      'workflows/TEST-alpha-2.json',
      'workflows/test-alpha.json'
    ])

    mockWorkflowStore.workflows = mockWorkflowStore.workflows.filter(
      (workflow) => workflow.path !== 'workflows/TEST-alpha-2.json'
    )
    await nextTick()

    expect(getLeafPaths(getSearchRoot())).toEqual(['workflows/test-alpha.json'])
  })
})
