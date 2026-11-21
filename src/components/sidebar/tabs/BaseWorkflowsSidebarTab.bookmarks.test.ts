import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import BaseWorkflowsSidebarTab from '@/components/sidebar/tabs/BaseWorkflowsSidebarTab.vue'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'

vi.mock(import('firebase/auth'))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/platform/workflow/core/services/workflowService'))

const bookmarksTree = 'sideToolbar.workflowTab.workflowTreeType.bookmarks'

function serveFavorites() {
  let favorites: string[] = []
  vi.mocked(api.getUserData).mockImplementation(
    async () => new Response(JSON.stringify({ favorites }), { status: 200 })
  )
  return {
    saveElsewhere: (next: string[]) => {
      favorites = next
    }
  }
}

async function renderSidebarWith(filename: string) {
  vi.mocked(api.listUserDataFullInfo).mockResolvedValue([
    { path: filename, modified: 1, size: 1 }
  ])
  await useWorkflowStore().syncWorkflows()
  render(BaseWorkflowsSidebarTab, {
    props: {
      title: 'Workflows',
      searchSubject: 'Workflow',
      dataTestid: 'workflows-sidebar'
    },
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          missingWarn: false,
          messages: { en: {} }
        })
      ],
      stubs: { teleport: true }
    }
  })
  await vi.waitFor(() => expect(api.getUserData).toHaveBeenCalledOnce())
}

describe('BaseWorkflowsSidebarTab bookmarks', () => {
  it.for([
    {
      name: 'the window regains focus',
      signal: () => window.dispatchEvent(new Event('focus'))
    },
    {
      name: 'the page becomes visible again',
      signal: () => {
        vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
        document.dispatchEvent(new Event('visibilitychange'))
      }
    }
  ])(
    'shows a workflow bookmarked in another tab once $name',
    async ({ signal }) => {
      const server = serveFavorites()
      await renderSidebarWith('portrait.json')
      expect(
        screen.queryByRole('tree', { name: bookmarksTree })
      ).not.toBeInTheDocument()

      server.saveElsewhere(['workflows/portrait.json'])
      signal()

      const bookmarks = await screen.findByRole('tree', { name: bookmarksTree })
      expect(
        within(bookmarks).getByRole('treeitem', { name: 'portrait' })
      ).toBeInTheDocument()
    }
  )
})
