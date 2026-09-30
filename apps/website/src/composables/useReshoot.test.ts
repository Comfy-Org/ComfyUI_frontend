import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, nextTick, ref } from 'vue'

import { refreshWorkshopCredits } from '../config/workshop-credits'
import { useWorkshopSession } from '../config/workshop-session-state'
import { clipSecondsOf } from '../lib/workshop/cinematic-studio/reshoot-clip'
import { readGeometry } from '../lib/workshop/cinematic-studio/reshoot-engine/cvgeo'
import {
  FREE_QUOTE,
  RESHOOT_CREDENTIAL,
  fakeGeometry,
  fakeTransport,
  signIn
} from '../lib/workshop/cinematic-studio/reshoot-engine/__fixtures__/reshootFakes'
import type { ReshootTransport } from '../lib/workshop/cinematic-studio/reshoot-engine/transport'
import { ReshootError } from '../lib/workshop/cinematic-studio/reshoot-engine/transport'
import { reshootTransport } from '../lib/workshop/cinematic-studio/reshoot-engine/transport-config'
import { useReshoot } from './useReshoot'

vi.mock(import('../config/workshop-session-state'))
vi.mock(import('../config/workshop-credits'))
vi.mock(import('../scripts/posthog'))
vi.mock(
  import('../lib/workshop/cinematic-studio/reshoot-engine/transport-config'),
  () => ({ reshootTransport: vi.fn() })
)
vi.mock(
  import('../lib/workshop/cinematic-studio/reshoot-engine/cvgeo'),
  () => ({ readGeometry: vi.fn() })
)
// jsdom never loads video metadata; each test says how long its clip is.
vi.mock(import('../lib/workshop/cinematic-studio/reshoot-clip'), () => ({
  clipSecondsOf: vi.fn(),
  fileSecondsOf: vi.fn()
}))

let transport: ReshootTransport

function start() {
  let reshoot: ReturnType<typeof useReshoot> | undefined
  render(
    defineComponent({
      setup() {
        reshoot = useReshoot()
        return () => null
      }
    })
  )
  if (!reshoot) throw new Error('not mounted')
  return reshoot
}

async function readScene(reshoot: ReturnType<typeof useReshoot>) {
  reshoot.pick()
  await vi.advanceTimersByTimeAsync(2_500)
}

beforeEach(() => {
  vi.useFakeTimers()
  transport = fakeTransport()
  vi.mocked(reshootTransport).mockReturnValue(transport)
  vi.mocked(readGeometry).mockResolvedValue(fakeGeometry())
  vi.mocked(clipSecondsOf).mockReset()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(new Blob(['clip'], { type: 'video/mp4' })))
  )
  signIn()
})

describe('useReshoot', () => {
  it('adds no take until depth has been read', async () => {
    const reshoot = start()
    const before = reshoot.takes.value.length

    await reshoot.generate()
    expect(reshoot.takes.value).toHaveLength(before)

    await readScene(reshoot)
    void reshoot.generate()
    expect(reshoot.takes.value).toHaveLength(before + 1)
  })

  it('reads the scene, then generates a take from the aimed camera', async () => {
    const reshoot = start()
    await vi.advanceTimersByTimeAsync(0)
    expect(reshoot.priceNote.value).toBe('Free · 3 of 5 left this week')

    await readScene(reshoot)
    expect(reshoot.depth.value).toBe('ready')
    expect(reshoot.frames.value).toBe(97)
    expect(transport.upload).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'input_crossviewwarp-1.mp4' }),
      expect.any(AbortSignal)
    )

    reshoot.aim({ azimuth: 25 })
    void reshoot.generate()
    expect(reshoot.current.value?.status).toBe('rendering')
    await vi.advanceTimersByTimeAsync(2_500)

    const take = reshoot.current.value
    expect(take).toMatchObject({ status: 'done', n: 1 })
    expect(take?.url).toMatch(/^blob:/)
    expect(take?.originalUrl).toMatch(/^blob:/)
    const [, [generate]] = vi.mocked(transport.submit).mock.calls
    expect(JSON.stringify(generate)).toContain('"azimuth":25')
    expect(transport.quote).toHaveBeenCalledTimes(2)
    expect(refreshWorkshopCredits).toHaveBeenCalledWith({ force: true })
  })

  it('reuses a scene it already read instead of analyzing again', async () => {
    const reshoot = start()
    await readScene(reshoot)
    reshoot.size.value = '768p'
    await vi.advanceTimersByTimeAsync(2_500)
    reshoot.size.value = '480p'
    await vi.advanceTimersByTimeAsync(2_500)

    const analyses = vi
      .mocked(transport.submit)
      .mock.calls.filter(([workflow]) =>
        JSON.stringify(workflow).includes('CrossViewGeometryExport')
      )
    expect(analyses).toHaveLength(2)
    expect(reshoot.depth.value).toBe('ready')
  })

  it('keeps Generate off while the price could not be fetched', async () => {
    vi.mocked(transport.quote).mockRejectedValue(new Error('network down'))
    const reshoot = start()
    await readScene(reshoot)

    expect(reshoot.depth.value).toBe('ready')
    expect(reshoot.priceNote.value).toBe(
      'Couldn’t get the price yet. Trying again…'
    )
    expect(reshoot.canGenerate.value).toBe(false)
  })

  it('asks for the price again once the scene is read', async () => {
    vi.mocked(transport.quote).mockRejectedValueOnce(new Error('network down'))
    const reshoot = start()
    await vi.advanceTimersByTimeAsync(0)
    expect(reshoot.canGenerate.value).toBe(false)

    await readScene(reshoot)
    expect(reshoot.priceNote.value).toBe('Free · 3 of 5 left this week')
    expect(reshoot.canGenerate.value).toBe(true)
  })

  it('retries a failed quote on its own after a short wait', async () => {
    vi.mocked(transport.quote).mockRejectedValueOnce(new Error('network down'))
    const reshoot = start()
    await vi.advanceTimersByTimeAsync(0)
    expect(transport.quote).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(5_000)
    expect(transport.quote).toHaveBeenCalledTimes(2)
    expect(reshoot.priceNote.value).toBe('Free · 3 of 5 left this week')
  })

  it('does not retry a quote for an app that does not exist', async () => {
    vi.mocked(transport.quote).mockRejectedValue(new ReshootError('not_found'))
    const reshoot = start()
    await vi.advanceTimersByTimeAsync(120_000)

    expect(transport.quote).toHaveBeenCalledTimes(1)
    expect(reshoot.priceNote.value).toBeUndefined()
  })

  it('lets the unmetered dev transport generate with no quote', async () => {
    vi.mocked(transport.quote).mockResolvedValue(undefined)
    const reshoot = start()
    await readScene(reshoot)

    expect(reshoot.priceNote.value).toBeUndefined()
    expect(reshoot.canGenerate.value).toBe(true)
  })

  it('keeps only the most recent scenes it read', async () => {
    const reshoot = start()
    await readScene(reshoot)
    for (const aspect of [
      '16:9',
      '9:16',
      '1:1',
      '4:3',
      'source',
      '4:3'
    ] as const) {
      reshoot.aspect.value = aspect
      await vi.advanceTimersByTimeAsync(2_500)
    }

    const analyses = vi
      .mocked(transport.submit)
      .mock.calls.filter(([workflow]) =>
        JSON.stringify(workflow).includes('CrossViewGeometryExport')
      )
    // The fifth read pushed out 'source', so it is read again; '4:3' is reused.
    expect(analyses).toHaveLength(6)
    expect(reshoot.depth.value).toBe('ready')
  })

  it('keeps the newest workspace quote when an older one answers last', async () => {
    const credential = ref(RESHOOT_CREDENTIAL)
    useWorkshopSession().session = computed(() => credential.value)
    let answerFirst: (quote: typeof FREE_QUOTE) => void = () => {}
    vi.mocked(transport.quote)
      .mockReturnValueOnce(new Promise((resolve) => (answerFirst = resolve)))
      .mockResolvedValueOnce({ ...FREE_QUOTE, next_run: 'paid' })
    const reshoot = start()

    credential.value = {
      ...RESHOOT_CREDENTIAL,
      workspace: { ...RESHOOT_CREDENTIAL.workspace, id: 'team' }
    }
    await vi.advanceTimersByTimeAsync(0)
    answerFirst(FREE_QUOTE)
    await vi.advanceTimersByTimeAsync(0)

    expect(reshoot.priceNote.value).toBe('40 credits')
  })

  it('does not upload an error response in place of the example clip', async () => {
    const fetchMock = vi.fn(
      async () => new Response('missing', { status: 404 })
    )
    vi.stubGlobal('fetch', fetchMock)
    const reshoot = start()

    reshoot.pick()
    await vi.advanceTimersByTimeAsync(0)
    expect(reshoot.depth.value).toBe('failed')
    expect(transport.upload).not.toHaveBeenCalled()

    reshoot.pick()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('downloads outputs only once their job has succeeded', async () => {
    const reshoot = start()
    await readScene(reshoot)
    void reshoot.generate()
    await vi.advanceTimersByTimeAsync(2_500)

    const order = (fn: { mock: { invocationCallOrder: number[] } }) =>
      fn.mock.invocationCallOrder
    for (const id of ['job-1', 'job-2']) {
      const polled = vi
        .mocked(transport.job)
        .mock.calls.flatMap(([jobId], i) =>
          jobId === id ? [order(vi.mocked(transport.job))[i]] : []
        )
      const downloads = vi
        .mocked(transport.output)
        .mock.calls.flatMap(([job], i) =>
          job.id === id ? [order(vi.mocked(transport.output))[i]] : []
        )
      expect(downloads.length).toBeGreaterThan(0)
      expect(Math.min(...downloads)).toBeGreaterThan(Math.max(...polled))
    }
    expect(transport.output).toHaveBeenCalledTimes(4)
  })

  it('says a server is starting while the deployment is not ready', async () => {
    vi.mocked(transport.submit).mockRejectedValueOnce(
      new ReshootError('deployment_not_ready')
    )
    const reshoot = start()
    reshoot.pick()
    await vi.advanceTimersByTimeAsync(1)

    expect(reshoot.stage.value).toBe('starting')
    await vi.advanceTimersByTimeAsync(12_500)
    expect(reshoot.depth.value).toBe('ready')
  })

  it('asks a signed-out visitor to sign in before reading the scene', async () => {
    useWorkshopSession().session = computed(() => undefined)
    const reshoot = start()
    reshoot.pick()
    await vi.advanceTimersByTimeAsync(2_500)

    expect(transport.upload).not.toHaveBeenCalled()
    expect(reshoot.depth.value).toBe('none')
    expect(reshoot.gate.value).toBe('signedOut')
    expect(reshoot.notice.value).toBe('Sign in to read the scene.')
    expect(reshoot.priceNote.value).toBeUndefined()
  })

  it('is unavailable when this Cloud has no Re-shoot app', async () => {
    vi.mocked(reshootTransport).mockReturnValue(undefined)
    const reshoot = start()
    reshoot.pick()
    await vi.advanceTimersByTimeAsync(2_500)

    expect(reshoot.gate.value).toBe('unavailable')
    expect(reshoot.depth.value).toBe('none')
    expect(reshoot.notice.value).toBe(
      'Re-shoot is not available right now. Try again later.'
    )
  })

  it.for<{
    name: string
    error: ReshootError
    role?: 'member'
    note: string
    gate?: string
  }>([
    {
      name: 'an owner out of credits',
      error: new ReshootError('insufficient_credits'),
      note: 'Not enough credits in Personal.',
      gate: 'noCredits'
    },
    {
      name: 'a member out of credits',
      error: new ReshootError('insufficient_credits'),
      role: 'member',
      note: 'Personal has used all its credits. Ask the workspace owner to add more, or run this on your personal workspace.',
      gate: 'memberNoCredits'
    },
    {
      name: 'no free runs left',
      error: new ReshootError('free_runs_exhausted', 7200),
      note: 'No free runs left; next one in 2 hours · 40 credits'
    },
    {
      name: 'the app unavailable for this attempt',
      error: new ReshootError('app_unavailable'),
      note: 'Re-shoot is not available right now. Try again later.',
      gate: 'ready'
    }
  ])('explains a refused take: $name', async ({ error, role, note, gate }) => {
    if (role) signIn({ ...RESHOOT_CREDENTIAL, role })
    const reshoot = start()
    await readScene(reshoot)
    vi.mocked(transport.submit).mockRejectedValueOnce(error)
    if (error.code === 'insufficient_credits')
      vi.mocked(transport.quote).mockResolvedValue({
        ...FREE_QUOTE,
        next_run: 'blocked',
        blocked_reason: 'insufficient_credits'
      })

    await reshoot.generate()
    await vi.advanceTimersByTimeAsync(0)

    expect(reshoot.current.value).toMatchObject({ status: 'failed', note })
    if (gate) expect(reshoot.gate.value).toBe(gate)
  })

  it('runs again after a take the app could not serve', async () => {
    const reshoot = start()
    await readScene(reshoot)
    vi.mocked(transport.submit).mockRejectedValueOnce(
      new ReshootError('app_unavailable')
    )
    await reshoot.generate()
    await vi.advanceTimersByTimeAsync(0)
    const submits = vi.mocked(transport.submit).mock.calls.length

    void reshoot.generate()
    await vi.advanceTimersByTimeAsync(2_500)

    expect(transport.submit).toHaveBeenCalledTimes(submits + 1)
    expect(reshoot.current.value?.status).toBe('done')
  })
})

type Graph = Record<string, { inputs: Record<string, unknown> }>

/** The camera node of the generate workflow sent for the latest take. */
function sentCamera() {
  const calls = vi.mocked(transport.submit).mock.calls
  const graph = calls[calls.length - 1][0] as Graph
  return graph['5'].inputs
}

function sentSeed() {
  const calls = vi.mocked(transport.submit).mock.calls
  return (calls[calls.length - 1][0] as Graph)['30'].inputs.noise_seed
}

describe('useReshoot: the camera move', () => {
  it('shoots a keyed move from its first key, with every key sent', async () => {
    const reshoot = start()
    await readScene(reshoot)
    reshoot.aim({ azimuth: 10 })
    reshoot.frame.value = 0
    reshoot.toggleKey()
    reshoot.frame.value = 40
    await nextTick()
    reshoot.aim({ azimuth: -20 })
    reshoot.toggleKey()
    // Aimed on a key, the key moves and the one camera does not.
    reshoot.frame.value = 0
    await nextTick()
    reshoot.aim({ azimuth: 33 })
    expect(reshoot.camera.azimuth).toBe(10)

    void reshoot.generate()
    await vi.advanceTimersByTimeAsync(2_500)

    const camera = sentCamera()
    expect(camera.azimuth).toBe(33)
    expect(camera.use_keyframes).toBe(true)
    const keyframes = JSON.parse(String(camera.keyframes)) as {
      f: number
      az: number
    }[]
    expect(keyframes.map(({ f, az }) => [f, az])).toEqual([
      [1, 33],
      [41, -20]
    ])
    expect(reshoot.current.value?.camera.azimuth).toBe(33)
  })

  it('only tries a pose between keys, until Key writes it', async () => {
    const reshoot = start()
    await readScene(reshoot)
    reshoot.frame.value = 0
    reshoot.toggleKey()
    reshoot.frame.value = 40
    await nextTick()
    reshoot.toggleKey()
    const keysBefore = JSON.stringify(reshoot.keys.value)
    const cameraBefore = { ...reshoot.camera }

    reshoot.frame.value = 20
    await nextTick()
    reshoot.aim({ elevation: 12 })
    expect(reshoot.view.value.elevation).toBe(12)
    expect(reshoot.onKey.value).toBe(false)
    expect(JSON.stringify(reshoot.keys.value)).toBe(keysBefore)
    expect({ ...reshoot.camera }).toEqual(cameraBefore)

    // Moving the playhead lets the tried pose go.
    reshoot.frame.value = 21
    await nextTick()
    expect(reshoot.view.value.elevation).not.toBe(12)

    reshoot.frame.value = 20
    await nextTick()
    reshoot.aim({ elevation: 12 })
    reshoot.toggleKey()
    expect(reshoot.keys.value.map((key) => key.frame)).toEqual([0, 20, 40])
    expect(reshoot.keys.value[1].camera.elevation).toBe(12)
  })

  it('takes a key away with the same button', async () => {
    const reshoot = start()
    await readScene(reshoot)
    reshoot.frame.value = 5
    reshoot.toggleKey()
    expect(reshoot.onKey.value).toBe(true)
    reshoot.toggleKey()
    expect(reshoot.keys.value).toEqual([])
    expect(reshoot.onKey.value).toBe(false)
  })

  it('shoots a single key as a held camera, not a move', async () => {
    const reshoot = start()
    await readScene(reshoot)
    reshoot.frame.value = 0
    reshoot.aim({ azimuth: 15 })
    reshoot.toggleKey()

    void reshoot.generate()
    await vi.advanceTimersByTimeAsync(2_500)

    expect(sentCamera()).toMatchObject({
      azimuth: 15,
      use_keyframes: false,
      keyframes: ''
    })
  })
})

describe('useReshoot: seeds and clips', () => {
  it('draws a new seed every take unless one is fixed', async () => {
    const random = vi
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0.25)
      .mockReturnValueOnce(0.75)
    const reshoot = start()
    await readScene(reshoot)

    void reshoot.generate()
    await vi.advanceTimersByTimeAsync(2_500)
    expect(sentSeed()).toBe(0.25 * 2 ** 32)
    void reshoot.generate()
    await vi.advanceTimersByTimeAsync(2_500)
    expect(sentSeed()).toBe(0.75 * 2 ** 32)

    reshoot.seed.value = 7
    void reshoot.generate()
    await vi.advanceTimersByTimeAsync(2_500)
    expect(sentSeed()).toBe(7)
    random.mockRestore()
  })

  it('never reads a clip too long for the node, and says why', async () => {
    vi.mocked(clipSecondsOf).mockResolvedValue(30)
    const reshoot = start()
    await vi.advanceTimersByTimeAsync(0)
    expect(reshoot.clipError.value).toBe(
      'This clip is 30.0 s. Use one between 5 and 15 seconds.'
    )

    await readScene(reshoot)

    expect(transport.upload).not.toHaveBeenCalled()
    expect(transport.submit).not.toHaveBeenCalled()
    expect(reshoot.depth.value).toBe('none')
    expect(reshoot.canGenerate.value).toBe(false)
  })

  it('times a clip that fits before its scene is read', async () => {
    vi.mocked(clipSecondsOf).mockResolvedValue(10)
    const reshoot = start()
    await vi.advanceTimersByTimeAsync(0)
    // 240 frames at 24 fps, cut to H3's 17k + 5 grid.
    expect(reshoot.frames.value).toBe(226)
    expect(reshoot.clipError.value).toBeUndefined()

    await readScene(reshoot)
    expect(reshoot.frames.value).toBe(97)
  })
})
