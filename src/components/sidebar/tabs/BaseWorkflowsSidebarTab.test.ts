import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref, watchEffect } from 'vue'
import { createI18n } from 'vue-i18n'

import BaseWorkflowsSidebarTab from '@/components/sidebar/tabs/BaseWorkflowsSidebarTab.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import {
  useWorkflowStore,
  useWorkflowBookmarkStore
} from '@/platform/workflow/management/stores/workflowStore'

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import type { TreeExplorerNode } from '@/types/treeExplorerTypes'
import { flattenTree } from '@/utils/treeUtil'
vi.mock(import('firebase/auth'))
vi.mock(import('vuefire'), () => ({ useFirebaseAuth: vi.fn() }))

beforeEach(() => {
  useSettingStore().settingValues['Comfy.Workflow.WorkflowTabsPosition'] =
    'Sidebar'
  vi.mocked(useWorkflowStore().syncWorkflows).mockResolvedValue(undefined)
  vi.mocked(useWorkflowBookmarkStore().loadBookmarks).mockResolvedValue(
    undefined
  )
})

const {
  setSearchQuery,
  emitSearch,
  captureSearchRoot,
  getSearchRoot,
  resetCapturedSearchRoot,
  mockExpandNode,
  mockToggleNodeOnEvent,
  mockWorkflowService,
  registerSearchHandlers
} = vi.hoisted(() => {
  let updateQuery = (_query: string) => {}
  let triggerSearch = (_query: string) => {}
  let capturedSearchRoot: TreeExplorerNode<ComfyWorkflow> | null = null

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
    mockWorkflowService: {
      openWorkflow: vi.fn().mockResolvedValue(undefined),
      closeWorkflow: vi.fn().mockResolvedValue(undefined),
      renameWorkflow: vi.fn().mockResolvedValue(undefined),
      deleteWorkflow: vi.fn().mockResolvedValue(undefined),
      insertWorkflow: vi.fn().mockResolvedValue(undefined),
      duplicateWorkflow: vi.fn().mockResolvedValue(undefined)
    },
    registerSearchHandlers: (
      updateHandler: (query: string) => void,
      searchHandler: (query: string) => void
    ) => {
      updateQuery = updateHandler
      triggerSearch = searchHandler
    }
  }
})

vi.mock<unknown>(
  import('@/components/common/NoResultsPlaceholder.vue'),
  () => ({
    default: { name: 'NoResultsPlaceholder', template: '<div />' }
  })
)

vi.mock<unknown>(
  import('@/components/ui/search-input/SearchInput.vue'),
  () => ({
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
  })
)

vi.mock<unknown>(
  import('@/components/sidebar/tabs/SidebarTopArea.vue'),
  () => ({
    default: { name: 'SidebarTopArea', template: '<div><slot /></div>' }
  })
)

vi.mock<unknown>(import('@/components/common/TextDivider.vue'), () => ({
  default: { name: 'TextDivider', template: '<div />' }
}))

vi.mock<unknown>(import('@/components/common/TreeExplorer.vue'), () => ({
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

vi.mock<unknown>(
  import('@/components/common/TreeExplorerTreeNode.vue'),
  () => ({
    default: {
      name: 'TreeExplorerTreeNode',
      template:
        '<div><slot name="before-label" :node="node" /><slot /><slot name="actions" :node="node" /></div>',
      props: ['node']
    }
  })
)

vi.mock<unknown>(
  import('@/components/sidebar/tabs/SidebarTabTemplate.vue'),
  () => ({
    default: {
      name: 'SidebarTabTemplate',
      template:
        '<div><slot name="alt-title" /><slot name="tool-buttons" /><slot name="header" /><slot name="body" /></div>'
    }
  })
)

vi.mock<unknown>(
  import('@/components/sidebar/tabs/workflows/WorkflowTreeLeaf.vue'),
  () => ({
    default: { name: 'WorkflowTreeLeaf', template: '<div />', props: ['node'] }
  })
)

vi.mock<unknown>(import('@/components/ui/button/Button.vue'), () => ({
  default: { name: 'Button', template: '<button><slot /></button>' }
}))

vi.mock<unknown>(import('@/composables/useTreeExpansion'), () => ({
  useTreeExpansion: () => ({
    expandNode: mockExpandNode,
    toggleNodeOnEvent: mockToggleNodeOnEvent
  })
}))

vi.mock<unknown>(import('@/composables/useAppMode'), () => ({
  useAppMode: () => ({ isAppMode: ref(false) })
}))

vi.mock<unknown>(
  import('@/platform/workflow/core/services/workflowService'),
  () => ({
    useWorkflowService: () => mockWorkflowService
  })
)

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
    resetCapturedSearchRoot()

    Object.assign(useWorkflowStore(), { workflows: [] })
    Object.assign(useWorkflowStore(), { persistedWorkflows: [] })
    Object.assign(useWorkflowStore(), { bookmarkedWorkflows: [] })
    Object.assign(useWorkflowStore(), { openWorkflows: [] })
    useWorkflowStore().activeWorkflow = null
    useWorkflowStore().isSyncLoading = false
  })

  const renderComponent = () =>
    render(BaseWorkflowsSidebarTab, {
      props: {
        title: 'Workflows',
        searchSubject: 'Workflow',
        dataTestid: 'workflows-sidebar'
      },
      global: {
        plugins: [i18n],
        stubs: { teleport: true }
      }
    })

  it('returns an empty filtered workflow set when searchQuery is empty', async () => {
    Object.assign(useWorkflowStore(), {
      workflows: [
        createMockWorkflow('workflows/test-alpha.json'),
        createMockWorkflow('workflows/test-beta.json')
      ]
    })

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
    Object.assign(useWorkflowStore(), {
      workflows: [
        createMockWorkflow('workflows/test-alpha.json'),
        createMockWorkflow('workflows/other-workflow.json'),
        createMockWorkflow('workflows/TEST-gamma.json')
      ]
    })

    renderComponent()

    setSearchQuery('ALPHA')
    await nextTick()

    expect(getLeafPaths(getSearchRoot())).toEqual(['workflows/test-alpha.json'])
  })

  it('refreshes when idle and exposes busy state while workflows are syncing', async () => {
    const user = userEvent.setup()

    renderComponent()

    const refreshButton = screen.getByRole('button', { name: 'g.refresh' })
    expect(refreshButton).toBeEnabled()
    expect(refreshButton).toHaveAttribute('aria-busy', 'false')

    await user.click(refreshButton)

    expect(useWorkflowStore().syncWorkflows).toHaveBeenCalledTimes(1)

    useWorkflowStore().isSyncLoading = true
    await nextTick()

    expect(refreshButton).toBeDisabled()
    expect(refreshButton).toHaveAttribute('aria-busy', 'true')

    useWorkflowStore().isSyncLoading = false
    await nextTick()

    expect(refreshButton).toBeEnabled()
    expect(refreshButton).toHaveAttribute('aria-busy', 'false')

    await user.click(refreshButton)

    expect(useWorkflowStore().syncWorkflows).toHaveBeenCalledTimes(2)
  })

  it('reactively updates filtered workflows when a workflow is removed', async () => {
    Object.assign(useWorkflowStore(), {
      workflows: [
        createMockWorkflow('workflows/test-alpha.json'),
        createMockWorkflow('workflows/TEST-alpha-2.json'),
        createMockWorkflow('workflows/test-beta.json')
      ]
    })

    renderComponent()

    setSearchQuery('alpha')
    await nextTick()
    expect(getLeafPaths(getSearchRoot())).toEqual([
      'workflows/TEST-alpha-2.json',
      'workflows/test-alpha.json'
    ])

    Object.assign(useWorkflowStore(), {
      workflows: useWorkflowStore().workflows.filter(
        (workflow) => workflow.path !== 'workflows/TEST-alpha-2.json'
      )
    })
    await nextTick()

    expect(getLeafPaths(getSearchRoot())).toEqual(['workflows/test-alpha.json'])
  })
})
