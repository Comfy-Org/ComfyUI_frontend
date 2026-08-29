import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, watchEffect } from 'vue'
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

beforeEach(() => {
  useSettingStore().settingValues['Comfy.Workflow.WorkflowTabsPosition'] =
    'Sidebar'
  vi.mocked(useWorkflowStore().syncWorkflows).mockResolvedValue(undefined)
  vi.mocked(useWorkflowBookmarkStore().loadBookmarks).mockResolvedValue(
    undefined
  )
})

const {
  captureSearchRoot,
  getSearchRoot,
  resetCapturedSearchRoot,
  mockExpandNode,
  mockToggleNodeOnEvent,
  mockWorkflowService
} = vi.hoisted(() => {
  let capturedSearchRoot: TreeExplorerNode<ComfyWorkflow> | null = null

  return {
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
      renameWorkflow: vi.fn().mockResolvedValue(true),
      deleteWorkflow: vi.fn().mockResolvedValue(true),
      insertWorkflow: vi.fn().mockResolvedValue(undefined),
      duplicateWorkflow: vi.fn().mockResolvedValue(undefined)
    }
  }
})

vi.mock<unknown>(
  import('@/components/sidebar/tabs/SidebarTopArea.vue'),
  () => ({
    default: { name: 'SidebarTopArea', template: '<div><slot /></div>' }
  })
)

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

vi.mock<unknown>(import('@/composables/useTreeExpansion'), () => ({
  useTreeExpansion: () => ({
    expandNode: mockExpandNode,
    toggleNodeOnEvent: mockToggleNodeOnEvent
  })
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
    await nextTick()

    expect(mockExpandNode).not.toHaveBeenCalled()
    expect(getLeafPaths(getSearchRoot())).toHaveLength(0)
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

    await userEvent.type(screen.getByRole('combobox'), 'ALPHA')
    await nextTick()

    expect(getLeafPaths(getSearchRoot())).toEqual(['workflows/test-alpha.json'])
  })

  it('propagates failed workflow operations to the tree', async () => {
    const workflow = createMockWorkflow('workflows/test.json')
    Object.assign(useWorkflowStore(), { workflows: [workflow] })
    mockWorkflowService.renameWorkflow.mockResolvedValueOnce(false)
    mockWorkflowService.deleteWorkflow.mockResolvedValueOnce(false)

    renderComponent()
    await userEvent.type(screen.getByRole('combobox'), 'test')
    await nextTick()
    const root = getSearchRoot()
    const leaf = root?.children?.find(({ data }) => data === workflow)

    expect(leaf?.data).toBe(workflow)
    expect(leaf?.handleRename).toBeTypeOf('function')
    expect(leaf?.handleDelete).toBeTypeOf('function')
    expect(await leaf?.handleRename?.('renamed')).toBe(false)
    expect(await leaf?.handleDelete?.()).toBe(false)
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

    await userEvent.type(screen.getByRole('combobox'), 'alpha')
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
