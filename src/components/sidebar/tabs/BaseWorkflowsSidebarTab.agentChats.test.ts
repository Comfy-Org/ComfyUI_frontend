import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import BaseWorkflowsSidebarTab from '@/components/sidebar/tabs/BaseWorkflowsSidebarTab.vue'
import { i18n } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import {
  useWorkflowBookmarkStore,
  useWorkflowStore
} from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'

vi.mock(import('firebase/auth'))
vi.mock(import('@/platform/workflow/core/services/workflowService'))

function savedWorkflow(name: string, open: boolean) {
  const workflow = createMockLoadedWorkflow({
    path: `workflows/${name}.json`,
    key: `${name}.json`,
    directory: 'workflows',
    filename: name,
    suffix: 'json',
    isPersisted: true,
    isTemporary: false,
    isModified: false
  })
  const workflowStore = useWorkflowStore()
  workflowStore.attachWorkflow(
    workflow,
    open ? workflowStore.openWorkflows.length : -1
  )
  return workflow
}

function setup() {
  const portrait = savedWorkflow('portrait', true)
  const archive = savedWorkflow('archive', false)
  savedWorkflow('sketch', false)
  vi.mocked(useWorkflowBookmarkStore().isBookmarked).mockImplementation(
    (path) => path === archive.path
  )
  const openChat = vi.fn()
  useWorkflowTabActivityStore().setAgentChats(
    new Map([
      [
        portrait.path,
        [
          { id: 'th-portrait-1', title: 'Portrait lighting', updatedAt: 0 },
          { id: 'th-portrait-2', title: 'Portrait crop', updatedAt: 0 }
        ]
      ],
      [archive.path, [{ id: 'th-archive', title: 'Old upscale', updatedAt: 0 }]]
    ]),
    openChat
  )
  render(BaseWorkflowsSidebarTab, {
    props: {
      title: 'Workflows',
      searchSubject: 'Workflows',
      dataTestid: 'workflows-sidebar'
    },
    global: { plugins: [i18n] }
  })
  return { portrait, archive, openChat }
}

describe('BaseWorkflowsSidebarTab agent chats', () => {
  beforeEach(() => {
    useSettingStore().settingValues['Comfy.Workflow.WorkflowTabsPosition'] =
      'Sidebar'
    vi.mocked(useWorkflowStore().syncWorkflows).mockResolvedValue(undefined)
    vi.mocked(useWorkflowBookmarkStore().loadBookmarks).mockResolvedValue(
      undefined
    )
  })

  it('shows a chat icon on every Open, Bookmarks and Browse row of a workflow with chats', () => {
    setup()

    const portraitChats = screen.getAllByRole('button', {
      name: '2 chats on portrait'
    })
    const archiveChats = screen.getAllByRole('button', {
      name: '1 chat on archive'
    })
    expect(portraitChats).toHaveLength(2)
    expect(archiveChats).toHaveLength(2)
    expect(
      within(screen.getByRole('treeitem', { name: 'sketch' })).queryByRole(
        'button',
        { name: /chats? on/ }
      )
    ).toBeNull()
  })

  it('opens the workflow card on hover over a row’s chat indicator without opening the workflow', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { archive, openChat } = setup()
    const [bookmarkRow] = screen.getAllByRole('treeitem', { name: 'archive' })

    await user.hover(
      within(bookmarkRow).getByRole('button', { name: '1 chat on archive' })
    )
    await vi.advanceTimersByTimeAsync(200)
    const card = screen.getByRole('menu')
    expect(within(card).getByText('archive')).toBeVisible()
    await user.click(
      within(card).getByRole('menuitem', { name: /^Old upscale/ })
    )

    expect(openChat).toHaveBeenCalledExactlyOnceWith(archive.path, 'th-archive')
    expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
  })
})
