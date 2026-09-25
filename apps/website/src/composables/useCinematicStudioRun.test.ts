import { render } from '@testing-library/vue'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { computed, defineComponent, nextTick, ref } from 'vue'
import { readGenerationTimings } from '../lib/workshop/cinematic-studio/generation-timings'
import type { AccountCredential } from '@comfyorg/account-core/session'

import { useWorkshopSession } from '../config/workshop-session-state'
import { useWorkshopCredits } from '../config/workshop-credits'
import { getRouterWorkshopModelDetail } from '../config/workshop-router-content'
import { prepareModelPage } from '../routes/models/model-page'
import { useWorkshopEnabled } from '../scripts/posthog'
import {
  readCinematicJournal,
  writeCinematicJournal
} from '../lib/workshop/cinematic-studio/journal'
import { useCinematicStudioRun } from './useCinematicStudioRun'

vi.mock(import('../config/workshop-session-state'))
vi.mock(import('../config/workshop-credits'))
vi.mock(import('../scripts/posthog'))

const SLUG = 'bfl--flux-2-pro--generate-images'
const REQUEST_ID = '6f1a1a6e-6a53-4a5f-9d3a-2b3b0a1f9c21'
const ID = '7f1a1a6e-6a53-4a5f-9d3a-2b3b0a1f9c21'
const NAMESPACE = JSON.stringify(['user', 'workspace'])
const credential: AccountCredential = {
  token: 'test-token',
  expiresAt: Date.now() + 60000,
  uid: 'user',
  workspace: { id: 'workspace', name: 'Workspace', type: 'personal' },
  role: 'owner',
  permissions: []
}
const model = getRouterWorkshopModelDetail(SLUG)
assert.isDefined(model)
assert.isDefined(model.execution)
const contractId = model.execution.id
const recovered = {
  id: ID,
  modelSlug: SLUG,
  contractId,
  requestId: REQUEST_ID,
  prompt: 'A harbor',
  aspect: '16:9' as const,
  startedAt: 100,
  status: 'pending' as const
}

beforeEach(() => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  localStorage.clear()
  vi.stubEnv('PUBLIC_WORKSHOP_ROUTER_RUN', '1')
  vi.mocked(useWorkshopEnabled).mockReturnValue(computed(() => true))
  const session = useWorkshopSession()
  session.session = computed(() => credential)
  vi.mocked(session.ensureFresh).mockResolvedValue({
    status: 'ok',
    session: credential
  })
  useWorkshopCredits().balance = computed(() => ({
    status: 'ok',
    credits: 100
  }))
})

function mountRun() {
  let run: ReturnType<typeof useCinematicStudioRun> | undefined
  const view = render(
    defineComponent({
      setup() {
        run = useCinematicStudioRun(1)
        return () => null
      }
    })
  )
  onTestFinished(view.unmount)
  assert.isDefined(run)
  return { run, unmount: view.unmount }
}

async function pageResponse(url: string) {
  return Response.json(
    await prepareModelPage(decodeURIComponent(url.split('/')[2]))
  )
}

describe('cinematic request recovery', () => {
  it.for(['cancel', 'switch-account'])(
    'does not record interrupted generation timing on %s',
    async (action) => {
      const current = ref(credential)
      useWorkshopSession().session = computed(() => current.value)
      const requested = Promise.withResolvers<void>()
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>(async (input, init) => {
          if (String(input).startsWith('/')) return pageResponse(String(input))
          requested.resolve()
          return new Promise<Response>((_, reject) =>
            init?.signal?.addEventListener(
              'abort',
              () => reject(new DOMException('Stopped', 'AbortError')),
              { once: true }
            )
          )
        })
      )
      const { run } = mountRun()
      await nextTick()
      const generating = run.generate({
        modelSlug: SLUG,
        prompt: 'Harbor',
        aspect: '16:9',
        resolutionPixels: 1024,
        takes: 1,
        references: []
      })
      await requested.promise
      if (action === 'cancel') run.cancel()
      else {
        current.value = { ...credential, uid: 'other-user' }
        await nextTick()
      }
      await generating
      expect(readGenerationTimings(NAMESPACE, SLUG)).toEqual([])
      expect(
        readGenerationTimings(JSON.stringify(['other-user', 'workspace']), SLUG)
      ).toEqual([])
    }
  )
  it('excludes a successful run that became hidden', async () => {
    const hidden = vi.spyOn(document, 'visibilityState', 'get')
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (input, init) => {
        if (String(input).startsWith('/')) return pageResponse(String(input))
        if (init?.method === 'POST') {
          hidden.mockReturnValue('hidden')
          document.dispatchEvent(new Event('visibilitychange'))
          hidden.mockReturnValue('visible')
          return Response.json(
            { request_id: REQUEST_ID, status: 'IN_QUEUE' },
            { status: 201 }
          )
        }
        return Response.json({
          id: 'result',
          status: 'Ready',
          result: { sample: 'https://example.com/image.png' }
        })
      })
    )
    const { run } = mountRun()
    await nextTick()
    await run.generate({
      modelSlug: SLUG,
      prompt: 'Harbor',
      aspect: '16:9',
      resolutionPixels: 1024,
      takes: 1,
      references: []
    })
    expect(run.reel.value.takes[0].status).toBe('done')
    expect(readGenerationTimings(NAMESPACE, SLUG)).toEqual([])
  })
  it.for([false, true])(
    'validates a motion batch before submission and stops at failure (invalid settings: %s)',
    async (invalid) => {
      const posts: string[] = []
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>(async (input, init) => {
          const url = String(input)
          if (url.startsWith('/')) return pageResponse(url)
          if (init?.method === 'POST') posts.push(url)
          return Response.json(
            { error: { message: 'Request rejected' } },
            { status: 400 }
          )
        })
      )
      const { run } = mountRun()
      await nextTick()
      const requests = ['Push in', 'Orbit left', 'Locked'].map(
        (prompt, index) => ({
          modelSlug: 'byteplus--seedance-2-5-text-to-video--generate-videos',
          prompt,
          aspect: '16:9' as const,
          resolutionPixels: 2048,
          takes: 1,
          references: [],
          video: {
            durationSeconds: invalid && index === 1 ? 999 : 5,
            resolution: '720p',
            generateAudio: false
          }
        })
      )
      await run.generateBatch(requests)
      expect(posts).toHaveLength(invalid ? 0 : 1)
      expect(run.rendering.value).toBe(false)
      expect(run.reel.value.takes).toHaveLength(3)
      expect(
        run.reel.value.takes.every((take) => take.status !== 'rendering')
      ).toBe(true)
    }
  )
  it('journals before submission and replaces unknown status only after queue admission', async () => {
    let elapsed = 0
    vi.spyOn(performance, 'now').mockImplementation(() => {
      elapsed += 10
      return elapsed
    })
    const statuses: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (input, init) => {
        const url = String(input)
        if (url.startsWith('/')) return pageResponse(url)
        statuses.push(readCinematicJournal(NAMESPACE)[0].status)
        if (init?.method === 'POST')
          return Response.json(
            { request_id: REQUEST_ID, status: 'IN_QUEUE' },
            { status: 201 }
          )
        return Response.json({
          id: 'result',
          status: 'Ready',
          result: { sample: 'https://example.com/image.png' }
        })
      })
    )
    const { run } = mountRun()
    await nextTick()
    await run.generate({
      modelSlug: SLUG,
      prompt: 'A harbor',
      aspect: '16:9',
      resolutionPixels: 1024,
      takes: 1,
      references: []
    })
    expect(statuses).toEqual(['unknown', 'pending'])
    expect(readCinematicJournal(NAMESPACE)[0]).toMatchObject({
      requestId: REQUEST_ID,
      status: 'complete'
    })
    expect(run.reel.value.takes.at(0)?.status).toBe('done')
    expect(readGenerationTimings(NAMESPACE, SLUG)).toHaveLength(1)
  })

  it('does not submit when the initial recovery receipt cannot be persisted', async () => {
    const network: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (input) => {
        network.push(String(input))
        if (!String(input).startsWith('/'))
          return Response.json({}, { status: 400 })
        return pageResponse(String(input))
      })
    )
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError')
    })
    const { run } = mountRun()
    await nextTick()
    await run.generate({
      modelSlug: SLUG,
      prompt: 'A harbor',
      aspect: '16:9',
      resolutionPixels: 1024,
      takes: 1,
      references: []
    })
    expect(network.every((url) => url.startsWith('/'))).toBe(true)
    expect(run.recoveryError.value).toBe(true)
    expect(run.reel.value.takes.at(0)?.status).toBe('failed')
    expect(readGenerationTimings(NAMESPACE, SLUG)).toEqual([])
  })

  it('collects a saved receipt after reload using only GET and retains it until media is saved', async () => {
    writeCinematicJournal(NAMESPACE, recovered)
    const requests: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (input, init) => {
        const url = String(input)
        requests.push(`${init?.method ?? 'GET'} ${url}`)
        if (url.startsWith('/')) return pageResponse(url)
        return Response.json({
          id: 'result',
          status: 'Ready',
          result: { sample: 'https://example.com/image.png' }
        })
      })
    )
    const { run } = mountRun()
    await nextTick()
    await run.recover(ID)
    expect(run.reel.value.takes.at(0)?.status).toBe('done')
    expect(requests.every((request) => request.startsWith('GET '))).toBe(true)
    expect(requests.at(-1)).toContain(
      `/v2/models/${contractId}/requests/${REQUEST_ID}`
    )
    expect(readCinematicJournal(NAMESPACE)[0].status).toBe('complete')
    expect(readGenerationTimings(NAMESPACE, SLUG)).toEqual([])
  })

  it('never automatically submits an unknown interrupted request', async () => {
    writeCinematicJournal(NAMESPACE, {
      ...recovered,
      requestId: undefined,
      status: 'unknown'
    })
    const fetcher = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetcher)
    const { run } = mountRun()
    await nextTick()
    await run.recover(ID)
    expect(fetcher).not.toHaveBeenCalled()
    expect(run.pending.value[0].status).toBe('unknown')
  })

  it.for([
    { action: 'detach', cancel: false },
    { action: 'cancel', cancel: true }
  ])(
    'distinguishes $action from cancelling the admitted request',
    async ({ cancel }) => {
      writeCinematicJournal(NAMESPACE, recovered)
      const requested = Promise.withResolvers<void>()
      const methods: string[] = []
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>(async (input, init) => {
          const url = String(input)
          if (url.startsWith('/')) return pageResponse(url)
          methods.push(init?.method ?? 'GET')
          if (init?.method === 'PUT') return Response.json({}, { status: 202 })
          requested.resolve()
          return new Promise<Response>((_, reject) =>
            init?.signal?.addEventListener(
              'abort',
              () => reject(new DOMException('Stopped', 'AbortError')),
              { once: true }
            )
          )
        })
      )
      const { run, unmount } = mountRun()
      await nextTick()
      const collecting = run.recover(ID)
      await requested.promise
      const stop = cancel ? run.cancel : unmount
      stop()
      await collecting
      expect(methods).toEqual(cancel ? ['GET', 'PUT'] : ['GET'])
      expect(readCinematicJournal(NAMESPACE)[0].status).toBe(
        cancel ? 'cancelRequested' : 'pending'
      )
    }
  )
})
