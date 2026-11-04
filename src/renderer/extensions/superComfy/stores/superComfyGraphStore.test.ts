import { getActivePinia } from 'pinia'
import { assert, describe, expect, it, vi } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import type { SuperGraphDocument } from '@/renderer/extensions/superComfy/engine/documentSchema'
import {
  docWith,
  fileItem,
  ioNode
} from '@/renderer/extensions/superComfy/engine/engineFixtures'
import { findNode } from '@/renderer/extensions/superComfy/engine/graphTopology'
import type { SuperComfyEvent } from '@/renderer/extensions/superComfy/engine/types'
import { api } from '@/scripts/api'

import { useSuperComfyGraphStore } from './superComfyGraphStore'

vi.mock(import('firebase/auth'))
vi.mock(import('@/scripts/api'))

type GraphStore = ReturnType<typeof useSuperComfyGraphStore>

async function openStore(): Promise<GraphStore> {
  const store = useSuperComfyGraphStore()
  await store.ensureLoaded()
  return store
}

function closePage(store: GraphStore) {
  window.dispatchEvent(new Event('pagehide'))
  store.$dispose()
  const pinia = getActivePinia()
  assert(pinia, 'no active Pinia')
  Reflect.deleteProperty(pinia.state.value, store.$id)
}

function serveUserdata(status: number, body: string | null = null) {
  vi.mocked(api.getUserData).mockResolvedValue(new Response(body, { status }))
}

function serveDoc(nodeId: string, savedAt: number) {
  serveUserdata(
    200,
    JSON.stringify({ ...docWith([ioNode(nodeId, 'image')]), savedAt })
  )
}

function lastSavedBody(): string {
  const body = vi.mocked(api.storeUserData).mock.lastCall?.[1]
  assert(typeof body === 'string', 'nothing was saved to userdata')
  return body
}

function applyEdits(store: GraphStore, edits: readonly SuperComfyEvent[]) {
  edits.forEach((edit) => store.dispatch(edit))
}

function nodeIds(doc: SuperGraphDocument): string[] {
  return doc.nodes.map(({ id }) => id)
}

async function moveEvery(store: GraphStore, intervalMs: number, times: number) {
  for (let step = 1; step <= times; step++) {
    store.dispatch({
      type: 'nodesMoved',
      moves: [{ id: 'busy', x: step, y: 0 }]
    })
    await vi.advanceTimersByTimeAsync(intervalMs)
  }
}

const addBusyNode: SuperComfyEvent = {
  type: 'nodeAdded',
  node: ioNode('busy', 'image')
}

describe('useSuperComfyGraphStore persistence', () => {
  it('brings items added to an I/O node back after a reload', async () => {
    vi.useFakeTimers()
    const store = await openStore()
    applyEdits(store, [
      { type: 'nodeAdded', node: ioNode('photos', 'image') },
      {
        type: 'itemsAdded',
        nodeId: 'photos',
        items: [fileItem('a.png')],
        mode: 'append'
      }
    ])
    await vi.advanceTimersByTimeAsync(1000)
    closePage(store)
    serveUserdata(200, lastSavedBody())

    const reopened = await openStore()

    expect(findNode(reopened.state.doc, 'photos')).toMatchObject({
      items: [fileItem('a.png')]
    })
  })

  it('still saves while the document keeps changing faster than the autosave delay', async () => {
    vi.useFakeTimers()
    const store = await openStore()
    store.dispatch(addBusyNode)

    await moveEvery(store, 500, 12)

    expect(api.storeUserData).toHaveBeenCalled()
  })

  it('keeps a change in the browser when the page closes before the autosave', async () => {
    vi.useFakeTimers()
    const store = await openStore()
    store.dispatch(addBusyNode)

    closePage(store)
    const reopened = await openStore()

    expect(nodeIds(reopened.state.doc)).toEqual(['busy'])
  })

  it('loads a newer save from elsewhere when the page closed with nothing unsaved', async () => {
    vi.useFakeTimers()
    const store = await openStore()
    store.dispatch(addBusyNode)
    await vi.advanceTimersByTimeAsync(2000)
    serveDoc('elsewhere', Date.now() - 500)

    closePage(store)
    const reopened = await openStore()

    expect(nodeIds(reopened.state.doc)).toEqual(['elsewhere'])
  })

  it.for<{ name: string; edits: SuperComfyEvent[] }>([
    { name: 'nothing changed', edits: [] },
    { name: 'the graph was edited', edits: [addBusyNode] }
  ])(
    'keeps the saved graph after a load that could not read it when $name',
    async ({ edits }) => {
      vi.useFakeTimers()
      serveUserdata(503)
      const store = await openStore()
      applyEdits(store, edits)
      await vi.advanceTimersByTimeAsync(2000)
      closePage(store)
      serveDoc('kept', 1000)

      const reopened = await openStore()
      await vi.advanceTimersByTimeAsync(2000)

      expect(nodeIds(reopened.state.doc)).toEqual(['kept'])
      expect(api.storeUserData).not.toHaveBeenCalled()
    }
  )

  it('warns when the saved graph could not be read', async () => {
    serveUserdata(503)

    await openStore()

    expect(useToast().toasts).toEqual([
      expect.objectContaining({
        kind: 'warning',
        title: t('superComfy.loadUnavailable')
      })
    ])
  })
})
