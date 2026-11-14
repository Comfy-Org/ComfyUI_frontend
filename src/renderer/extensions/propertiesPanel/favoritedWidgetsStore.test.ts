import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { reportError } from '@comfyorg/telemetry/reportError'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { useFavoritedWidgetsStore } from '@/renderer/extensions/propertiesPanel/favoritedWidgetsStore'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))
vi.mock(import('@comfyorg/telemetry/reportError'))

function addNode(id: number, title: string, widgetNames: string[]) {
  const node = new LGraphNode(title)
  node.id = toNodeId(id)
  for (const name of widgetNames) node.addWidget('number', name, 0, () => {})
  app.rootGraph.add(node)
  return node
}

describe('useFavoritedWidgetsStore', () => {
  it('persists favorites to workflow.extra in display order', () => {
    const sampler = addNode(3, 'KSampler', ['seed', 'steps'])
    const store = useFavoritedWidgetsStore()

    store.addFavorite(sampler, 'steps')
    store.addFavorite(sampler, 'seed')
    store.addFavorite(sampler, 'steps')

    expect(app.rootGraph.extra.favoritedWidgets).toEqual({
      favorites: [
        { nodeLocatorId: '3', widgetName: 'steps' },
        { nodeLocatorId: '3', widgetName: 'seed' }
      ]
    })
    expect(store.validFavoritedWidgets.map((fav) => fav.label)).toEqual([
      'KSampler / steps',
      'KSampler / seed'
    ])
  })

  it('loads the legacy nodeId format from workflow.extra', () => {
    const sampler = addNode(7, 'KSampler', ['cfg'])
    app.rootGraph.extra.favoritedWidgets = {
      favorites: [{ nodeId: 7, widgetName: 'cfg' }]
    }

    const store = useFavoritedWidgetsStore()

    expect(store.isFavorited(sampler, 'cfg')).toBe(true)
  })

  it('keeps a favorite whose node was deleted out of the valid list', () => {
    addNode(2, 'Loader', ['ckpt_name'])
    app.rootGraph.extra.favoritedWidgets = {
      favorites: [
        { nodeLocatorId: '2', widgetName: 'ckpt_name' },
        { nodeLocatorId: '9', widgetName: 'seed' }
      ]
    }

    const store = useFavoritedWidgetsStore()

    expect(store.favoritedWidgets.map((fav) => fav.label)).toEqual([
      'Loader / ckpt_name',
      'seed (node deleted)'
    ])
    expect(store.validFavoritedWidgets).toHaveLength(1)
  })

  it('prunes invalid favorites from workflow.extra', () => {
    addNode(2, 'Loader', ['ckpt_name'])
    app.rootGraph.extra.favoritedWidgets = {
      favorites: [
        { nodeLocatorId: '2', widgetName: 'missing' },
        { nodeLocatorId: '2', widgetName: 'ckpt_name' }
      ]
    }
    const store = useFavoritedWidgetsStore()

    store.pruneInvalidFavorites()

    expect(app.rootGraph.extra.favoritedWidgets).toEqual({
      favorites: [{ nodeLocatorId: '2', widgetName: 'ckpt_name' }]
    })
  })

  it('removes a favorite through toggleFavorite', () => {
    const sampler = addNode(3, 'KSampler', ['seed'])
    const store = useFavoritedWidgetsStore()
    store.toggleFavorite(sampler, 'seed')

    store.toggleFavorite(sampler, 'seed')

    expect(store.isFavorited(sampler, 'seed')).toBe(false)
    expect(app.rootGraph.extra.favoritedWidgets).toEqual({ favorites: [] })
  })

  describe('when workflow.extra cannot be read or written', () => {
    const storedFavorites = {
      favorites: [{ nodeLocatorId: '1', widgetName: 'seed' }]
    }

    beforeEach(() => {
      app.rootGraph.extra = {}
    })

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
      expect(reportError).toHaveBeenCalledExactlyOnceWith(
        expect.any(TypeError),
        {
          errorType: 'favorited_widgets_load_failure',
          surface: 'workspace'
        }
      )
    })

    it('keeps the persisted favorites and reports when saving fails', () => {
      app.rootGraph.extra = Object.freeze({ favoritedWidgets: storedFavorites })
      const store = useFavoritedWidgetsStore()

      store.clearFavorites()

      expect(store.favoritedWidgets).toEqual([])
      expect(app.rootGraph.extra.favoritedWidgets).toBe(storedFavorites)
      expect(reportError).toHaveBeenCalledExactlyOnceWith(
        expect.any(TypeError),
        {
          errorType: 'favorited_widgets_save_failure',
          surface: 'workspace'
        }
      )
    })
  })
})
