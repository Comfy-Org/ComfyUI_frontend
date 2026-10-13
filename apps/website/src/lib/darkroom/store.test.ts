import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DarkroomItem, DarkroomStore } from './store'
import { openDarkroomStore, TRASH_LIFETIME_MS } from './store'

function item(id: string, created: number): DarkroomItem {
  return {
    id,
    created,
    mime: 'image/png',
    settings: {
      prompt: 'a fox reading a map',
      model: 'vertexai/gemini-nano-banana-2.1',
      aspectRatio: '16:9',
      imageSize: '2K',
      mimeType: 'image/png',
      temperature: 1,
      seed: 100,
      jobId: 'job',
      run: 0,
      runs: 1,
      inputCount: 0
    },
    stats: { finishReasons: ['STOP'] },
    text: []
  }
}

const image = () => new Blob(['pixels'], { type: 'image/png' })

let store: DarkroomStore
beforeEach(async () => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  store = await openDarkroomStore('uid', 'workspace')
})

describe('darkroom store', () => {
  it('keeps an image with its settings, newest first', async () => {
    await store.saveItem(item('old', 1), image())
    await store.saveItem(item('new', 2), image())

    expect((await store.items()).map((saved) => saved.id)).toEqual([
      'new',
      'old'
    ])
    expect(await store.blob('new')).toBeDefined()
    expect(await store.blob('missing')).toBeUndefined()
  })

  it('keeps one account apart from another', async () => {
    await store.saveItem(item('mine', 1), image())
    const other = await openDarkroomStore('someone-else', 'workspace')
    const workspace = await openDarkroomStore('uid', 'team')

    expect(await other.items()).toEqual([])
    expect(await workspace.items()).toEqual([])
  })

  it('stars an image and takes the star off again', async () => {
    await store.saveItem(item('a', 1), image())

    await store.patchItem('a', { starred: true })
    expect((await store.items())[0].starred).toBe(true)

    await store.patchItem('a', { starred: false })
    expect(await store.items()).toEqual([item('a', 1)])
  })

  it('records the Cloud asset an image was saved as', async () => {
    await store.saveItem(item('a', 1), image())
    await store.patchItem('a', { cloudAssetId: 'asset-1' })
    expect((await store.items())[0].cloudAssetId).toBe('asset-1')
  })

  it('keeps both changes when two land on one image at once', async () => {
    await store.saveItem(item('a', 1), image())

    await Promise.all([
      store.patchItem('a', { starred: true }),
      store.patchItem('a', { cloudAssetId: 'asset-1' })
    ])

    expect((await store.items())[0]).toMatchObject({
      starred: true,
      cloudAssetId: 'asset-1'
    })
  })

  it('leaves an image that is gone alone', async () => {
    await store.patchItem('missing', { starred: true })
    expect(await store.items()).toEqual([])
  })

  it('moves deleted images to the trash, where Undo can reach them', async () => {
    await store.saveItem(item('a', 1), image())
    await store.saveItem(item('b', 2), image())

    await store.trash(['a'])
    expect((await store.items()).map((saved) => saved.id)).toEqual(['b'])

    expect(await store.restore(['a'])).toEqual([item('a', 1)])
    expect((await store.items()).map((saved) => saved.id)).toEqual(['b', 'a'])
  })

  it('clears trash older than a day the next time it opens', async () => {
    const now = Date.now()
    const earlier = await openDarkroomStore('uid', 'workspace', () => now)
    await earlier.saveItem(item('a', 1), image())
    await earlier.trash(['a'])
    earlier.close()
    store.close()

    const later = await openDarkroomStore(
      'uid',
      'workspace',
      () => now + TRASH_LIFETIME_MS + 1
    )
    expect(await later.restore(['a'])).toEqual([])
    expect(await later.blob('a')).toBeUndefined()
  })

  it('keeps trash that is still inside the Undo window', async () => {
    const now = Date.now()
    await store.saveItem(item('a', 1), image())
    await store.trash(['a'])
    store.close()

    const later = await openDarkroomStore(
      'uid',
      'workspace',
      () => now + 60_000
    )
    expect(await later.restore(['a'])).toHaveLength(1)
  })

  it('keeps moodboards and the images uploaded to them', async () => {
    const upload = await store.saveUpload(image())
    const board = {
      id: 'board',
      name: 'Dusk',
      created: 1,
      updated: 1,
      items: [upload, 'a']
    }
    await store.saveBoard(board)

    expect(await store.boards()).toEqual([board])
    expect(await store.blob(upload)).toBeDefined()

    // Only uploads are removed: a generated image belongs to the feed.
    await store.deleteUploads([upload, 'a'])
    await store.deleteBoard('board')
    expect(await store.blob(upload)).toBeUndefined()
    expect(await store.boards()).toEqual([])
  })

  it('remembers the requests still developing', async () => {
    const pending = {
      requestId: '18655193-3f73-4abf-b49c-1c6a058355bc',
      settings: item('a', 1).settings,
      created: 5,
      imageCount: 2
    }
    await store.savePending(pending)
    expect(await store.pending()).toEqual([pending])

    await store.removePending(pending.requestId)
    expect(await store.pending()).toEqual([])
  })
})
