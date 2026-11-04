import { describe, expect, it, vi } from 'vitest'

import {
  docWith,
  ioNode
} from '@/renderer/extensions/superComfy/engine/engineFixtures'
import type { SuperGraphDocument } from '@/renderer/extensions/superComfy/engine/documentSchema'
import { api } from '@/scripts/api'

import { createSuperGraphSaver, loadSuperGraph } from './superComfyPersistence'

vi.mock(import('@/scripts/api'))

function savedDoc(nodeId: string, savedAt: number): SuperGraphDocument {
  return { ...docWith([ioNode(nodeId, 'image')]), savedAt }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

const userdataSession = { location: 'userdata', readFailed: false } as const

async function saveToBrowser(
  doc: SuperGraphDocument,
  at: number,
  readFailed = false
) {
  vi.useFakeTimers({ now: at })
  await createSuperGraphSaver({ location: 'browser', readFailed }).save(doc)
  vi.useRealTimers()
}

describe('loadSuperGraph', () => {
  it.for([
    {
      name: 'the userdata copy when it is newer',
      remoteAt: 2000,
      draftAt: 1000,
      expected: 'remote'
    },
    {
      name: 'the browser copy when it is newer',
      remoteAt: 1000,
      draftAt: 2000,
      expected: 'draft'
    }
  ])('loads $name', async ({ remoteAt, draftAt, expected }) => {
    await saveToBrowser(savedDoc('draft', 0), draftAt)
    vi.mocked(api.getUserData).mockResolvedValue(
      jsonResponse(savedDoc('remote', remoteAt))
    )

    const loaded = await loadSuperGraph()

    expect(loaded.doc.nodes.map(({ id }) => id)).toEqual([expected])
    expect(loaded.location).toBe('userdata')
  })

  it.for([
    {
      name: 'the userdata copy when it exists',
      remote: jsonResponse(savedDoc('remote', 1000)),
      expected: 'remote'
    },
    {
      name: 'the browser copy when nothing is in userdata',
      remote: new Response(null, { status: 404 }),
      expected: 'draft'
    }
  ])(
    'prefers $name over a newer browser copy made when userdata could not be read',
    async ({ remote, expected }) => {
      await saveToBrowser(savedDoc('draft', 0), 2000, true)
      vi.mocked(api.getUserData).mockResolvedValue(remote)

      const loaded = await loadSuperGraph()

      expect(loaded.doc.nodes.map(({ id }) => id)).toEqual([expected])
    }
  )

  it('starts an empty graph when nothing was saved yet', async () => {
    vi.mocked(api.getUserData).mockResolvedValue(
      new Response(null, { status: 404 })
    )

    const loaded = await loadSuperGraph()

    expect(loaded).toEqual({
      doc: expect.objectContaining({ nodes: [], edges: [] }),
      location: 'userdata',
      recovered: false,
      readFailed: false
    })
  })

  it('uses the browser copy and says so when userdata cannot be read', async () => {
    await saveToBrowser(savedDoc('draft', 0), 1000)
    vi.mocked(api.getUserData).mockResolvedValue(
      new Response(null, { status: 403 })
    )

    const loaded = await loadSuperGraph()

    expect(loaded.doc.nodes.map(({ id }) => id)).toEqual(['draft'])
    expect(loaded.location).toBe('browser')
    expect(loaded.readFailed).toBe(true)
  })

  it('moves an invalid file aside and starts a new graph', async () => {
    vi.mocked(api.getUserData).mockResolvedValue(
      jsonResponse({ version: 7, nodes: 'broken' })
    )

    const loaded = await loadSuperGraph()

    expect(api.moveUserData).toHaveBeenCalledWith(
      'supercomfy/default.json',
      'supercomfy/default.invalid.json',
      { overwrite: true }
    )
    expect(loaded.doc.nodes).toEqual([])
    expect(loaded.recovered).toBe(true)
    expect(loaded.location).toBe('userdata')
  })

  it('never writes over an invalid file it could not move aside', async () => {
    vi.mocked(api.getUserData).mockResolvedValue(jsonResponse({ broken: true }))
    vi.mocked(api.moveUserData).mockResolvedValue(
      new Response(null, { status: 500 })
    )

    const loaded = await loadSuperGraph()
    const saved = await createSuperGraphSaver(loaded).save(savedDoc('a', 0))

    expect(saved).toBe('browser')
    expect(api.storeUserData).not.toHaveBeenCalled()
  })
})

describe('createSuperGraphSaver', () => {
  it('saves to userdata while userdata accepts the file', async () => {
    const { save } = createSuperGraphSaver(userdataSession)

    const location = await save(savedDoc('a', 0))

    expect(location).toBe('userdata')
    expect(api.storeUserData).toHaveBeenCalledWith(
      'supercomfy/default.json',
      expect.stringContaining('"id":"a"'),
      { overwrite: true, stringify: false, throwOnError: false }
    )
  })

  it('falls back to the browser for the rest of the session once userdata refuses', async () => {
    vi.mocked(api.storeUserData).mockResolvedValue(
      new Response(null, { status: 403 })
    )
    const { save } = createSuperGraphSaver(userdataSession)

    const first = await save(savedDoc('first', 0))
    const second = await save(savedDoc('second', 0))
    vi.mocked(api.getUserData).mockResolvedValue(
      new Response(null, { status: 403 })
    )
    const loaded = await loadSuperGraph()

    expect([first, second]).toEqual(['browser', 'browser'])
    expect(api.storeUserData).toHaveBeenCalledOnce()
    expect(loaded.doc.nodes.map(({ id }) => id)).toEqual(['second'])
  })
})
