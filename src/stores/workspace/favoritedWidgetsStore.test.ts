import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { useFavoritedWidgetsStore } from '@/stores/workspace/favoritedWidgetsStore'

vi.mock(import('@/scripts/app'))
vi.mock(import('@/platform/telemetry/reportError'))

const storedFavorites = {
  favorites: [{ nodeLocatorId: '1', widgetName: 'seed' }]
}

describe('useFavoritedWidgetsStore', () => {
  it('clears favorites and reports when the workflow data cannot be loaded', async () => {
    app.rootGraph.extra.favoritedWidgets = storedFavorites
    const store = useFavoritedWidgetsStore()
    expect(store.favoritedWidgets).toHaveLength(1)

    app.rootGraph.extra.favoritedWidgets = { favorites: 'not-a-list' }
    useWorkflowStore().activeWorkflow = fromPartial({
      path: 'workflows/malformed.json'
    })
    await nextTick()

    expect(store.favoritedWidgets).toEqual([])
    expect(reportError).toHaveBeenCalledExactlyOnceWith(expect.any(TypeError), {
      errorType: 'favorited_widgets_load_failure',
      surface: 'workspace'
    })
  })

  it('keeps the persisted favorites and reports when saving fails', () => {
    app.rootGraph.extra.favoritedWidgets = storedFavorites
    const store = useFavoritedWidgetsStore()
    Object.freeze(app.rootGraph.extra)

    store.clearFavorites()

    expect(store.favoritedWidgets).toEqual([])
    expect(app.rootGraph.extra.favoritedWidgets).toBe(storedFavorites)
    expect(reportError).toHaveBeenCalledExactlyOnceWith(expect.any(TypeError), {
      errorType: 'favorited_widgets_save_failure',
      surface: 'workspace'
    })
  })
})
