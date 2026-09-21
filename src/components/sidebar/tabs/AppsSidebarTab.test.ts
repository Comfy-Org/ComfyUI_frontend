import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import {
  useWorkflowStore,
  useWorkflowBookmarkStore
} from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useCommandStore } from '@/stores/commandStore'

import AppsSidebarTab from './AppsSidebarTab.vue'
vi.mock(import('firebase/auth'))
vi.mock(import('vuefire'), () => ({ useFirebaseAuth: vi.fn() }))

beforeEach(() => {
  vi.mocked(useCommandStore().execute).mockResolvedValue(undefined)
  vi.mocked(useWorkflowStore().syncWorkflows).mockResolvedValue(undefined)
  vi.mocked(useWorkflowBookmarkStore().loadBookmarks).mockResolvedValue(
    undefined
  )
})

vi.mock<unknown>(
  import('@/platform/workflow/core/services/workflowService'),
  () => ({
    useWorkflowService: () => ({})
  })
)

vi.mock(
  import('@/platform/telemetry/searchQuery/useSearchQueryTracking'),
  () => ({
    useSearchQueryTracking: () => undefined
  })
)

vi.mock<unknown>(import('@/composables/useAppMode'), async () => {
  const { computed } = await import('vue')
  return { useAppMode: () => ({ isAppMode: computed(() => true) }) }
})

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
    Object.assign(useWorkflowStore(), { persistedWorkflows: [] })
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

    expect(useCommandStore().execute).toHaveBeenCalledWith(
      'Comfy.NewBlankWorkflow'
    )
  })

  it('runs the new-workflow command from the empty-state action', async () => {
    const { user } = renderTab({ hasResults: false })

    await user.click(screen.getByRole('button', { name: 'Create app' }))

    expect(useCommandStore().execute).toHaveBeenCalledWith(
      'Comfy.NewBlankWorkflow'
    )
  })

  describe('with the real workflows tab', () => {
    it('counts only app workflows as results', async () => {
      Object.assign(useWorkflowStore(), {
        persistedWorkflows: [
          await makeWorkflow('workflows/my-app.app.json'),
          await makeWorkflow('workflows/regular.json')
        ]
      })

      renderTabWithRealBase()

      expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Create app' })
      ).not.toBeInTheDocument()
    })

    it('shows the empty state when no app workflows exist', async () => {
      Object.assign(useWorkflowStore(), {
        persistedWorkflows: [await makeWorkflow('workflows/regular.json')]
      })

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
