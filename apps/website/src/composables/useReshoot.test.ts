import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent } from 'vue'

import { refreshWorkshopCredits } from '../config/workshop-credits'
import { useWorkshopSession } from '../config/workshop-session-state'
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
      name: 'the app switched off',
      error: new ReshootError('app_unavailable'),
      note: 'Re-shoot is not available right now. Try again later.',
      gate: 'unavailable'
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
})
