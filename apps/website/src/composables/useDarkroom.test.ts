import { render } from '@testing-library/vue'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, ref } from 'vue'

import { requestWorkshopBuyCreditsAutomatically } from '@/config/workshop-buy-credits'
import { refreshWorkshopCredits } from '@/config/workshop-credits'
import { useWorkshopModelBalance } from '@/config/workshop-model-balance'
import { isDone, isPending } from '@/lib/darkroom/feed'
import type { DarkroomDraft } from '@/lib/darkroom/request'
import { signIn } from '@/lib/workshop/cinematic-studio/reshoot-engine/__fixtures__/reshootFakes'
import { useWorkshopEnabled } from '@/scripts/posthog'

import type { DarkroomNotice } from './useDarkroom'
import { useDarkroom } from './useDarkroom'

vi.mock(import('@/config/workshop-session-state'))
vi.mock(import('@/config/workshop-credits'))
vi.mock(import('@/scripts/posthog'))
vi.mock(import('@/config/workshop-model-balance'), () => ({
  useWorkshopModelBalance: vi.fn()
}))
vi.mock(import('@/config/workshop-buy-credits'), () => ({
  requestWorkshopBuyCredits: vi.fn(),
  requestWorkshopBuyCreditsAutomatically: vi.fn(),
  subscribeToWorkshopBuyCredits: vi.fn()
}))

const DRAFT: DarkroomDraft = {
  prompt: 'A fox reading a map',
  model: 'vertexai/gemini-nano-banana-2.1',
  aspectRatio: '16:9',
  imageSize: '2K',
  mimeType: 'image/png',
  temperature: 1
}

interface Router {
  limit: number
  /** How a submit is refused, if it is. */
  refusal?: { status: number; errorType: string }
  /** Whether a queued request has an answer yet. */
  finished: boolean
  readonly submitted: Record<string, unknown>[]
  readonly cancelled: string[]
}

/** Answers Router's endpoints the way the page will meet them. */
function routeRouter(): Router {
  const router: Router = {
    limit: 5,
    finished: true,
    submitted: [],
    cancelled: []
  }
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    if (url.endsWith('/partner-node-concurrency'))
      return Response.json({ limit: router.limit, reason: 'default' })
    if (url.endsWith('/cancel')) {
      router.cancelled.push(url)
      return Response.json({})
    }
    if (method === 'POST') {
      if (router.refusal)
        return Response.json(
          { error_type: router.refusal.errorType },
          {
            status: router.refusal.status,
            headers: { 'X-Comfy-Error-Type': router.refusal.errorType }
          }
        )
      router.submitted.push(JSON.parse(String(init?.body)))
      const id = String(router.submitted.length).padStart(12, '0')
      return Response.json(
        {
          request_id: `00000000-0000-4000-8000-${id}`,
          status: 'IN_QUEUE',
          queue_position: 0
        },
        { status: 201 }
      )
    }
    if (!router.finished)
      return Response.json(
        { status: 'IN_QUEUE', queue_position: 3 },
        { status: 202, headers: { 'Retry-After': '10' } }
      )
    return Response.json({
      candidates: [
        {
          content: {
            parts: [{ inlineData: { mimeType: 'image/png', data: 'AQID' } }]
          },
          finishReason: 'STOP'
        }
      ],
      usageMetadata: { totalTokenCount: 1200 }
    })
  })
  return router
}

function start() {
  const notices: DarkroomNotice[] = []
  let darkroom: ReturnType<typeof useDarkroom> | undefined
  const view = render(
    defineComponent({
      setup() {
        darkroom = useDarkroom((notice) => notices.push(notice))
        return () => null
      }
    })
  )
  if (!darkroom) throw new Error('not mounted')
  return { darkroom, notices, unmount: view.unmount }
}

async function ready(darkroom: ReturnType<typeof useDarkroom>) {
  await vi.waitFor(() => expect(darkroom.loaded.value).toBe(true))
  await vi.waitFor(() => expect(darkroom.gate.value).toBe('ready'))
}

const slotsOf = (darkroom: ReturnType<typeof useDarkroom>) =>
  darkroom.jobs.value.flatMap((job) => job.slots)

async function developed(darkroom: ReturnType<typeof useDarkroom>, count = 2) {
  await darkroom.generate(DRAFT, [], count, '100')
  await vi.waitFor(() =>
    expect(slotsOf(darkroom).filter(isDone)).toHaveLength(count)
  )
  return slotsOf(darkroom)
    .filter(isDone)
    .map((slot) => slot.item)
}

let router: Router
beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  vi.stubEnv('PUBLIC_WORKSHOP_ROUTER_RUN', '1')
  vi.mocked(useWorkshopEnabled).mockReturnValue(ref(true))
  vi.mocked(useWorkshopModelBalance).mockReturnValue(
    computed(() => ({ status: 'ok' as const, credits: 500 }))
  )
  router = routeRouter()
})

describe('useDarkroom', () => {
  it('asks a visitor to sign in before anything is made', async () => {
    const { darkroom } = start()

    await vi.waitFor(() => expect(darkroom.gate.value).toBe('signedOut'))
    expect(await darkroom.generate(DRAFT, [], 2, '')).toBe(false)
    expect(router.submitted).toEqual([])
  })

  it('makes one request per image, each with the next seed', async () => {
    signIn()
    const { darkroom } = start()
    await ready(darkroom)

    const items = await developed(darkroom, 2)

    expect(router.submitted.map((body) => body.generationConfig)).toMatchObject(
      [{ seed: 100 }, { seed: 101 }]
    )
    expect(items.map((item) => item.settings.seed)).toEqual([100, 101])
    expect(items[0].stats.totalTokens).toBe(1200)
    expect(darkroom.urls.get(items[0].id)).toMatch(/^blob:/)
    expect(refreshWorkshopCredits).toHaveBeenCalledWith({ force: true })
  })

  it('keeps the feed for the next visit', async () => {
    signIn()
    const first = start()
    await ready(first.darkroom)
    await developed(first.darkroom, 2)
    first.unmount()

    const { darkroom } = start()
    await ready(darkroom)

    expect(slotsOf(darkroom).filter(isDone)).toHaveLength(2)
    expect(darkroom.jobs.value[0].settings.prompt).toBe('A fox reading a map')
  })

  it('makes no more images at once than the account may run', async () => {
    router.limit = 1
    signIn()
    const { darkroom } = start()
    await ready(darkroom)
    await vi.waitFor(() => expect(darkroom.maxRuns.value).toBe(1))

    await darkroom.generate(DRAFT, [], 4, '')

    await vi.waitFor(() => expect(router.submitted).toHaveLength(1))
    expect(slotsOf(darkroom)).toHaveLength(1)
  })

  it('makes nothing for an account with partner models turned off', async () => {
    router.limit = 0
    signIn()
    const { darkroom } = start()
    await ready(darkroom)
    await vi.waitFor(() => expect(darkroom.blocked.value).toBe(true))

    expect(await darkroom.generate(DRAFT, [], 2, '')).toBe(false)
    expect(router.submitted).toEqual([])
  })

  it('opens the top-up dialog when the account is out of credits', async () => {
    router.refusal = { status: 402, errorType: 'insufficient_credits' }
    signIn()
    const { darkroom } = start()
    await ready(darkroom)

    await darkroom.generate(DRAFT, [], 1, '')

    await vi.waitFor(() =>
      expect(slotsOf(darkroom)[0]).toMatchObject({
        status: 'error',
        failure: 'noCredits'
      })
    )
    expect(requestWorkshopBuyCreditsAutomatically).toHaveBeenCalled()
    // What was sent is kept, so the tile can offer Try again.
    expect(darkroom.canRetry(slotsOf(darkroom)[0].key)).toBe(true)
  })

  it('retries a failed image with the same request', async () => {
    router.refusal = { status: 500, errorType: 'internal_error' }
    signIn()
    const { darkroom } = start()
    await ready(darkroom)
    await darkroom.generate(DRAFT, [], 1, '7')
    await vi.waitFor(() => expect(slotsOf(darkroom)[0].status).toBe('error'))

    router.refusal = undefined
    darkroom.retry(slotsOf(darkroom)[0].key)

    await vi.waitFor(() => expect(slotsOf(darkroom)[0].status).toBe('done'))
    expect(router.submitted[0].generationConfig).toMatchObject({ seed: 7 })
  })

  it('replays the same request after a dropped connection, never a second one', async () => {
    signIn()
    const { darkroom } = start()
    await ready(darkroom)
    const keys: (string | null)[] = []
    const routed = vi.mocked(fetch).getMockImplementation()
    let dropped = false
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (init?.method !== 'POST') return routed!(input, init)
      keys.push(new Headers(init.headers).get('Idempotency-Key'))
      if (!dropped) {
        dropped = true
        throw new TypeError('Failed to fetch')
      }
      return routed!(input, init)
    })

    await darkroom.generate(DRAFT, [], 1, '')
    await vi.waitFor(() =>
      expect(slotsOf(darkroom)[0]).toMatchObject({ failure: 'network' })
    )
    darkroom.retry(slotsOf(darkroom)[0].key)
    await vi.waitFor(() => expect(slotsOf(darkroom)[0].status).toBe('done'))

    expect(keys).toHaveLength(2)
    expect(keys[0]).toBeTruthy()
    expect(keys[1]).toBe(keys[0])
  })

  it('sends a new request once Router has answered the last one', async () => {
    router.refusal = { status: 500, errorType: 'internal_error' }
    signIn()
    const { darkroom } = start()
    await ready(darkroom)
    const keys: (string | null)[] = []
    const routed = vi.mocked(fetch).getMockImplementation()
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (init?.method === 'POST')
        keys.push(new Headers(init.headers).get('Idempotency-Key'))
      return routed!(input, init)
    })

    await darkroom.generate(DRAFT, [], 1, '')
    await vi.waitFor(() => expect(slotsOf(darkroom)[0].status).toBe('error'))
    darkroom.retry(slotsOf(darkroom)[0].key)
    await vi.waitFor(() => expect(keys).toHaveLength(2))

    expect(keys[1]).not.toBe(keys[0])
  })

  it('cancels an image still in line, on Router too', async () => {
    router.finished = false
    signIn()
    const { darkroom } = start()
    await ready(darkroom)
    await darkroom.generate(DRAFT, [], 1, '')
    await vi.waitFor(() =>
      expect(slotsOf(darkroom)[0]).toMatchObject({ phase: 'queued', ahead: 3 })
    )

    const [slot] = slotsOf(darkroom).filter(isPending)
    darkroom.cancel(slot)

    expect(slotsOf(darkroom)[0]).toMatchObject({
      status: 'error',
      failure: 'cancelledInLine',
      cancelled: true
    })
    await vi.waitFor(() => expect(router.cancelled).toHaveLength(1))
  })

  it('deletes with Undo, and keeps starred images', async () => {
    signIn()
    const { darkroom, notices } = start()
    await ready(darkroom)
    const [kept, gone] = await developed(darkroom, 2)

    await darkroom.setStarred([kept.id], true)
    await darkroom.deleteItems([kept.id, gone.id])

    expect(
      slotsOf(darkroom)
        .filter(isDone)
        .map((slot) => slot.item.id)
    ).toEqual([kept.id])
    const notice = notices.at(-1)
    expect(notice).toMatchObject({
      key: 'deletedKept',
      values: { count: 1, kept: 1 }
    })

    notice?.undo?.()
    await vi.waitFor(() =>
      expect(slotsOf(darkroom).filter(isDone)).toHaveLength(2)
    )
    expect(notices.at(-1)).toMatchObject({ key: 'restored' })
  })

  it('refuses to delete an image while it is starred', async () => {
    signIn()
    const { darkroom, notices } = start()
    await ready(darkroom)
    const [item] = await developed(darkroom, 1)
    await darkroom.setStarred([item.id], true)

    await darkroom.deleteItems([item.id])

    expect(slotsOf(darkroom).filter(isDone)).toHaveLength(1)
    expect(notices.at(-1)).toEqual({ key: 'starredKeptOne' })
  })

  it('collects images in a moodboard and drops the deleted ones', async () => {
    signIn()
    const { darkroom, notices } = start()
    await ready(darkroom)
    const [first, second] = await developed(darkroom, 2)

    await darkroom.addToBoard([first.id, second.id], undefined, 'Dusk')
    const [board] = darkroom.boards.value
    expect(board).toMatchObject({ name: 'Dusk', items: [first.id, second.id] })
    expect(notices.at(-1)).toMatchObject({
      key: 'addedToBoard',
      values: { count: 2, name: 'Dusk' }
    })

    await darkroom.updateBoard(board.id, { name: '  Night  ' })
    expect(darkroom.boardById(board.id)?.name).toBe('Night')

    await darkroom.deleteItems([second.id])
    expect(darkroom.boardItems(darkroom.boards.value[0])).toEqual([first.id])

    await darkroom.deleteBoard(board.id)
    expect(darkroom.boards.value).toEqual([])
  })

  it('keeps images uploaded to a moodboard', async () => {
    signIn()
    const { darkroom } = start()
    await ready(darkroom)
    const board = await darkroom.createBoard('References')

    await darkroom.uploadToBoard(board.id, [
      new File(['pixels'], 'a.png', { type: 'image/png' }),
      new File(['notes'], 'a.txt', { type: 'text/plain' })
    ])

    const [upload] = darkroom.boardItems(darkroom.boards.value[0])
    expect(darkroom.boards.value[0].items).toHaveLength(1)
    expect(darkroom.urls.get(upload)).toMatch(/^blob:/)
  })

  it('empties the feed when the account signs out', async () => {
    signIn()
    const { darkroom, unmount } = start()
    await ready(darkroom)
    await developed(darkroom, 1)

    unmount()

    expect(darkroom.jobs.value).toEqual([])
    expect(darkroom.urls.size).toBe(0)
  })
})
