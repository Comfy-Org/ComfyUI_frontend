import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'

import AppsSidebarTab from './AppsSidebarTab.vue'

const execute = vi.hoisted(() => vi.fn())

const workflowStoreState = vi.hoisted(() => ({
  persistedWorkflows: [] as ComfyWorkflow[]
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({ execute })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', async () => {
  const { ComfyWorkflow } =
    await import('@/platform/workflow/management/stores/comfyWorkflow')
  return {
    ComfyWorkflow,
    useWorkflowStore: () => ({
      get workflows() {
        return workflowStoreState.persistedWorkflows
      },
      get persistedWorkflows() {
        return workflowStoreState.persistedWorkflows
      },
      bookmarkedWorkflows: [],
      openWorkflows: [],
      activeWorkflow: undefined,
      isSyncLoading: false,
      syncWorkflows: vi.fn()
    }),
    useWorkflowBookmarkStore: () => ({ loadBookmarks: vi.fn() })
  }
})

vi.mock('@/platform/workflow/core/services/workflowService', () => ({
  useWorkflowService: () => ({})
}))

vi.mock('@/platform/telemetry/searchQuery/useSearchQueryTracking', () => ({
  useSearchQueryTracking: () => undefined
}))

vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: () => ({ shiftDown: false })
}))

vi.mock('@/composables/useAppMode', async () => {
  const { computed } = await import('vue')
  return { useAppMode: () => ({ isAppMode: computed(() => true) }) }
})

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: () => undefined })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        beta: 'Beta',
        refresh: 'Refresh',
        searchPlaceholder: 'Search {subject}'
      },
      sideToolbar: {
        workflowTab: {
          workflowTreeType: {
            open: 'Open',
            bookmarks: 'Bookmarks',
            browse: 'Browse'
          }
        }
      },
      linearMode: {
        appModeToolbar: {
          apps: 'Apps',
          create: 'Create',
          createApp: 'Create app',
          appsEmptyMessage: 'No apps yet',
          appsEmptyMessageAction: 'Create one to get started'
        }
      }
    }
  }
})

const noResultsPlaceholderStub = {
  props: ['buttonLabel'],
  emits: ['action'],
  template: '<button @click="$emit(\'action\')">{{ buttonLabel }}</button>'
}

function renderTab({ hasResults = true }: { hasResults?: boolean } = {}) {
  const user = userEvent.setup()
  const result = render(AppsSidebarTab, {
    global: {
      plugins: [i18n],
      stubs: {
        BaseWorkflowsSidebarTab: {
          template: `<div><slot name="header-actions" :has-results="${hasResults}" /><slot name="empty-state" /></div>`
        },
        NoResultsPlaceholder: noResultsPlaceholderStub
      }
    }
  })
  return { ...result, user }
}

async function makeWorkflow(path: string): Promise<ComfyWorkflow> {
  const { ComfyWorkflow } =
    await import('@/platform/workflow/management/stores/comfyWorkflow')
  return new ComfyWorkflow({ path, modified: 0, size: 1 })
}

function renderTabWithRealBase() {
  const user = userEvent.setup()
  const result = render(AppsSidebarTab, {
    global: {
      plugins: [i18n],
      directives: { tooltip: {} },
      stubs: {
        SidebarTabTemplate: {
          template:
            '<div><slot name="alt-title" /><slot name="tool-buttons" /><slot name="header" /><slot name="body" /></div>'
        },
        SidebarTopArea: { template: '<div><slot /></div>' },
        SearchInput: { template: '<input />', methods: { focus() {} } },
        TreeExplorer: { template: '<div data-testid="tree-explorer" />' },
        NoResultsPlaceholder: noResultsPlaceholderStub
      }
    }
  })
  return { ...result, user }
}

describe('AppsSidebarTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    workflowStoreState.persistedWorkflows = []
  })

  it('shows the create action only when there are results', () => {
    const { unmount } = renderTab({ hasResults: false })
    expect(
      screen.queryByRole('button', { name: 'Create' })
    ).not.toBeInTheDocument()
    unmount()

    renderTab({ hasResults: true })
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
  })

  it('runs the new-workflow command when the create action is clicked', async () => {
    const { user } = renderTab({ hasResults: true })

    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(execute).toHaveBeenCalledWith('Comfy.NewBlankWorkflow')
  })

  it('runs the new-workflow command from the empty-state action', async () => {
    const { user } = renderTab({ hasResults: false })

    await user.click(screen.getByRole('button', { name: 'Create app' }))

    expect(execute).toHaveBeenCalledWith('Comfy.NewBlankWorkflow')
  })

  describe('with the real workflows tab', () => {
    it('counts only app workflows as results', async () => {
      workflowStoreState.persistedWorkflows = [
        await makeWorkflow('workflows/my-app.app.json'),
        await makeWorkflow('workflows/regular.json')
      ]

      renderTabWithRealBase()

      expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Create app' })
      ).not.toBeInTheDocument()
    })

    it('shows the empty state when no app workflows exist', async () => {
      workflowStoreState.persistedWorkflows = [
        await makeWorkflow('workflows/regular.json')
      ]

      renderTabWithRealBase()

      expect(
        screen.queryByRole('button', { name: 'Create' })
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Create app' })
      ).toBeInTheDocument()
    })
  })
})
