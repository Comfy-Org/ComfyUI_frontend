// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import type { HubCreatorsSnapshot } from '@/lib/hub/creators'
import { fetchSnapshot, getJson } from './refresh-hub-creators-snapshot'

type Workflow = HubCreatorsSnapshot['workflows'][number]
interface Page {
  workflows: Workflow[]
  next_cursor?: string
}

const workflow = (shareId: string, username = 'purz'): Workflow => ({
  share_id: shareId,
  name: `Workflow ${shareId}`,
  status: 'approved',
  is_app: false,
  publish_time: '2026-09-01T10:00:00Z',
  profile: { username }
})

const snapshotOf = (count: number): HubCreatorsSnapshot => ({
  fetched_at: '2026-10-01T00:00:00Z',
  profiles: [{ username: 'purz' }],
  workflows: Array.from({ length: count }, (_, i) => workflow(`w${i}`))
})

function fakeHub(pages: Record<string, Page>) {
  let requests = 0
  return async (url: string): Promise<unknown> => {
    if (++requests > 10) throw new Error('kept asking for the same pages')
    const { pathname, searchParams } = new URL(url)
    const [, resource, username] =
      pathname.match(/\/(workflows|profiles)\/?(.*)$/) ?? []
    if (resource === 'profiles') return { username }
    return pages[searchParams.get('cursor') ?? '']
  }
}

describe('fetchSnapshot', () => {
  it('follows the cursor across pages', async () => {
    const snapshot = await fetchSnapshot(
      fakeHub({
        '': { workflows: [workflow('a1')], next_cursor: 'c1' },
        c1: { workflows: [workflow('b1', 'sirolim')] }
      })
    )

    expect(snapshot.workflows.map(({ share_id }) => share_id)).toEqual([
      'a1',
      'b1'
    ])
    expect(snapshot.profiles).toEqual([
      { username: 'purz' },
      { username: 'sirolim' }
    ])
  })

  it('stops when the API hands back a cursor it already gave', async () => {
    await expect(
      fetchSnapshot(
        fakeHub({
          '': { workflows: [workflow('a1')], next_cursor: 'c1' },
          c1: { workflows: [workflow('b1')], next_cursor: 'c1' }
        })
      )
    ).rejects.toThrow('cursor c1 twice')
  })

  it.for([
    {
      case: 'no workflows at all',
      fetched: 0,
      current: 4,
      error: 'no workflows'
    },
    {
      case: 'fewer than half of the current workflows',
      fetched: 1,
      current: 4,
      error: '1 workflows'
    }
  ])('refuses a snapshot with $case', async ({ fetched, current, error }) => {
    const workflows = Array.from({ length: fetched }, (_, i) =>
      workflow(`n${i}`)
    )

    await expect(
      fetchSnapshot(fakeHub({ '': { workflows } }), snapshotOf(current))
    ).rejects.toThrow(error)
  })

  it('accepts a snapshot with half of the current workflows', async () => {
    const snapshot = await fetchSnapshot(
      fakeHub({ '': { workflows: [workflow('n1'), workflow('n2')] } }),
      snapshotOf(4)
    )

    expect(snapshot.workflows).toHaveLength(2)
  })
})

describe('getJson', () => {
  it('gives up on a request that hangs for 15 seconds', async () => {
    vi.useFakeTimers()
    vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms) => {
      const controller = new AbortController()
      setTimeout(
        () => controller.abort(new DOMException('timed out', 'TimeoutError')),
        ms
      )
      return controller.signal
    })
    vi.mocked(fetch).mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) =>
          init?.signal?.addEventListener('abort', () =>
            reject(init.signal?.reason)
          )
        )
    )

    await Promise.all([
      expect(
        getJson('https://cloud.comfy.org/api/hub/workflows')
      ).rejects.toThrow('timed out'),
      vi.advanceTimersByTimeAsync(15_000)
    ])
  })
})
