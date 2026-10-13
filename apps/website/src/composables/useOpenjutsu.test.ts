import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import type { VideoTrim } from '@/components/workshop/video-trim/VideoTrimDialog.vue'
import { refreshWorkshopCredits } from '@/config/workshop-credits'
import { signIn } from '@/lib/workshop/cinematic-studio/reshoot-engine/__fixtures__/reshootFakes'
import type { ReshootTransport } from '@/lib/workshop/cinematic-studio/reshoot-engine/transport'
import { SWAP_EXAMPLES } from '@/lib/workshop/openjutsu/examples'
import { sampleTransport } from '@/lib/workshop/openjutsu/sample-transport'
import { openjutsuTransport } from '@/lib/workshop/openjutsu/transport-config'
import type { VideoFacts } from '@/lib/workshop/video-trim/filmstrip'
import { readVideoFacts } from '@/lib/workshop/video-trim/filmstrip'
import { captureWorkshopEvent } from '@/scripts/posthog'
import { useOpenjutsu } from './useOpenjutsu'

const backend = vi.hoisted(() => ({ noAccount: true }))

vi.mock(import('@/config/workshop-session-state'))
vi.mock(import('@/config/workshop-credits'))
vi.mock(import('@/scripts/posthog'))
vi.mock(import('@/lib/workshop/video-trim/filmstrip'))
vi.mock(import('@/lib/workshop/openjutsu/transport-config'), () => ({
  OPENJUTSU_SAMPLE_MODE: true,
  get OPENJUTSU_NO_ACCOUNT() {
    return backend.noAccount
  },
  openjutsuTransport: vi.fn()
}))

type Scenario = ReturnType<Parameters<typeof sampleTransport>[0]>

const clip = new File(['clip'], 'clip.mp4', { type: 'video/mp4' })
const hero = new File(['hero'], 'hero.png', { type: 'image/png' })
/** A 20 second 1080p clip, trimmed to seconds 2 to 8. */
const trimmed: VideoTrim = {
  start: 2,
  end: 8,
  duration: 20,
  width: 1920,
  height: 1080
}

const facts = (duration: number): VideoFacts => ({
  duration,
  width: 1920,
  height: 1080
})

let scenario: Scenario
let transport: ReshootTransport

function start() {
  let swap: ReturnType<typeof useOpenjutsu> | undefined
  render(
    defineComponent({
      setup() {
        swap = useOpenjutsu()
        return () => null
      }
    })
  )
  if (!swap) throw new Error('not mounted')
  return swap
}

/** A page with everything a run needs, and its price read. */
async function ready() {
  const swap = start()
  await swap.takeVideo(clip)
  swap.editTrim()
  swap.confirmTrim(trimmed)
  swap.takeCharacter(hero)
  swap.target.value = 'the man'
  await vi.advanceTimersByTimeAsync(0)
  return swap
}

beforeEach(() => {
  vi.useFakeTimers()
  backend.noAccount = true
  scenario = 'free'
  vi.mocked(readVideoFacts).mockResolvedValue(facts(20))
  transport = sampleTransport(() => scenario)
  vi.mocked(openjutsuTransport).mockReturnValue(transport)
})

describe('useOpenjutsu', () => {
  it('asks for the video, then the character, then who to replace', async () => {
    const swap = start()
    await vi.advanceTimersByTimeAsync(0)
    expect(swap.missing.value).toBe('video')

    await swap.takeVideo(clip)
    expect(swap.video.value).toBe(clip)
    expect(swap.missing.value).toBe('character')

    swap.takeCharacter(hero)
    expect(swap.missing.value).toBe('target')
    expect(swap.canGenerate.value).toBe(false)

    swap.target.value = 'the man'
    expect(swap.missing.value).toBeUndefined()
    expect(swap.canGenerate.value).toBe(true)
  })

  it.for([
    { seconds: 8, range: { start: 0, seconds: 8 }, trimmed: false },
    { seconds: 20, range: { start: 0, seconds: 15 }, trimmed: true }
  ])(
    'uses a $seconds s video at once, from its start up to 15 s',
    async ({ seconds, range, trimmed }) => {
      vi.mocked(readVideoFacts).mockResolvedValue(facts(seconds))
      const swap = start()

      await swap.takeVideo(clip)

      expect(swap.trimOpen.value).toBe(false)
      expect(swap.range.value).toEqual(range)
      expect(swap.trimmed.value).toBe(trimmed)
    }
  )

  it.for([
    { case: 'unreadable', read: undefined },
    { case: 'too short', read: facts(3) }
  ])(
    'opens the trim on a $case video and keeps the one in use',
    async ({ read }) => {
      const swap = await ready()
      const other = new File(['other'], 'other.mp4', { type: 'video/mp4' })
      vi.mocked(readVideoFacts).mockResolvedValue(read)

      await swap.takeVideo(other)

      expect(swap.trimOpen.value).toBe(true)
      expect(swap.trimming.value).toBe(other)
      expect(swap.video.value).toBe(clip)
    }
  )

  it('loads an example with its clip, character and words, on the default settings', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async (url: string) =>
          new Response(new Blob([url], { type: 'application/octet-stream' }))
      )
    )
    const swap = start()
    swap.size.value = '480p'
    swap.seed.value = 7

    const loading = swap.takeExample(SWAP_EXAMPLES[0])
    expect(swap.loadingExample.value).toBe('road')
    await loading

    expect(swap.video.value?.name).toBe('road.mp4')
    expect(swap.character.value?.name).toBe('robot.jpg')
    expect(swap.target.value).toBe('the man in the red jacket')
    expect(swap.size.value).toBe('768p')
    expect(swap.seed.value).toBeUndefined()
    expect(swap.loadingExample.value).toBeUndefined()
    vi.unstubAllGlobals()
  })

  it('takes the video out and puts it back as it was', async () => {
    const swap = await ready()

    swap.removeVideo()
    expect(swap.video.value).toBeUndefined()
    expect(swap.missing.value).toBe('video')

    swap.restoreVideo()
    expect(swap.video.value).toBe(clip)
    expect(swap.range.value).toEqual({ start: 2, seconds: 6 })
    expect(swap.removed.value).toBeUndefined()
  })

  it('reads the part, the result size and the price from what was chosen', async () => {
    const swap = await ready()

    expect(swap.range.value).toEqual({ start: 2, seconds: 6 })
    expect(swap.partSeconds.value).toBe(6)
    expect(swap.savedSize.value).toEqual({ width: 1344, height: 756 })
    expect(swap.priceNote.value).toBe('Free · 3 of 5 left today')

    swap.size.value = '480p'
    expect(swap.savedSize.value).toEqual({ width: 854, height: 480 })
  })

  it('reopens the trim on the video in use at the part chosen', async () => {
    const swap = await ready()

    swap.editTrim()

    expect(swap.trimming.value).toBe(clip)
    expect(swap.trimInitial.value).toEqual({ start: 2, end: 8 })
  })

  it('runs a swap into a take that ends with a result', async () => {
    const swap = await ready()
    const submit = vi.spyOn(transport, 'submit')
    const quote = vi.spyOn(transport, 'quote')

    void swap.generate()
    expect(swap.current.value).toMatchObject({
      n: 1,
      status: 'rendering',
      phase: 'uploading',
      target: 'the man',
      window: { start: 2, seconds: 6 },
      seconds: 6,
      size: '768p'
    })
    expect(swap.canGenerate.value, 'one take at a time').toBe(false)

    await vi.advanceTimersByTimeAsync(10_000)

    expect(swap.current.value).toMatchObject({
      status: 'done',
      phase: undefined
    })
    expect(swap.current.value?.url).toMatch(/^blob:/)
    expect(swap.rendering.value).toBe(false)
    const sent = JSON.stringify(submit.mock.calls.at(0)?.at(0))
    expect(sent).toContain('"start_time":2')
    expect(sent).toContain('"width":1344')
    expect(quote, 'the price is read again after a run').toHaveBeenCalledOnce()
    expect(
      captureWorkshopEvent,
      'no account, nothing reported'
    ).not.toHaveBeenCalled()
  })

  it('uploads a file once across takes', async () => {
    const swap = await ready()
    const upload = vi.spyOn(transport, 'upload')

    void swap.generate()
    await vi.advanceTimersByTimeAsync(10_000)
    void swap.generate()
    await vi.advanceTimersByTimeAsync(10_000)

    expect(swap.takes.value.map((take) => take.status)).toEqual([
      'done',
      'done'
    ])
    expect(upload).toHaveBeenCalledTimes(2)
  })

  it('says why a take failed and leaves the inputs as they were', async () => {
    scenario = 'fails'
    const swap = await ready()

    void swap.generate()
    await vi.advanceTimersByTimeAsync(10_000)

    expect(swap.current.value).toMatchObject({
      status: 'failed',
      note: 'The swap did not finish. Try again, or try a shorter part.'
    })
    expect(swap.current.value?.url).toBeUndefined()
    expect(swap.target.value).toBe('the man')
    expect(swap.canGenerate.value).toBe(true)
  })

  it('stops a take when asked, and never gives it a result', async () => {
    const swap = await ready()
    const cancel = vi.spyOn(transport, 'cancel')

    void swap.generate()
    await vi.advanceTimersByTimeAsync(2_500)
    swap.cancel()
    await vi.advanceTimersByTimeAsync(10_000)

    expect(swap.current.value).toMatchObject({ status: 'cancelled' })
    expect(swap.current.value?.url).toBeUndefined()
    expect(cancel).toHaveBeenCalledOnce()
    expect(swap.canGenerate.value).toBe(true)
  })

  it("puts a take's words and seed back for another go", async () => {
    const swap = await ready()
    void swap.generate()
    await vi.advanceTimersByTimeAsync(10_000)
    const made = swap.current.value
    swap.target.value = 'someone else'

    swap.reuse(made?.id ?? '')

    expect(swap.target.value).toBe('the man')
    expect(swap.seed.value).toBe(made?.seed)
    expect(swap.selected.value).toBe('source')
  })

  it.for<[Scenario, string]>([
    ['no-credits', 'noCredits'],
    ['unavailable', 'unavailable']
  ])('offers no run when the backend answers %s', async ([answer, gate]) => {
    scenario = answer
    const swap = await ready()

    expect(swap.gate.value).toBe(gate)
    expect(swap.canGenerate.value).toBe(false)
    await swap.generate()
    expect(swap.takes.value).toHaveLength(0)
  })

  it('holds a run back when free runs are used up', async () => {
    scenario = 'exhausted'
    const swap = await ready()

    expect(swap.gate.value).toBe('ready')
    expect(swap.priceNote.value).toContain('No free runs left')
    expect(swap.canGenerate.value).toBe(false)
  })

  describe('on a backend that needs an account', () => {
    beforeEach(() => {
      backend.noAccount = false
    })

    it('asks for sign-in and reads no price until there is someone to ask as', async () => {
      const quote = vi.spyOn(transport, 'quote')
      const swap = await ready()

      expect(swap.gate.value).toBe('signedOut')
      expect(quote).not.toHaveBeenCalled()
      expect(swap.canGenerate.value).toBe(false)
    })

    it('reports a run for the account that started it, and rereads its credits', async () => {
      signIn()
      const swap = await ready()
      expect(swap.gate.value).toBe('ready')

      void swap.generate()
      await vi.advanceTimersByTimeAsync(10_000)

      expect(swap.current.value).toMatchObject({ status: 'done' })
      const events = vi
        .mocked(captureWorkshopEvent)
        .mock.calls.map(([event]) => event)
      expect(events).toMatchObject([
        { name: 'run_started', properties: { app_slug: 'apps/openjutsu' } },
        {
          name: 'run_finished',
          properties: { status: 'succeeded', output_count: 1 }
        }
      ])
      expect(refreshWorkshopCredits).toHaveBeenCalledWith({ force: true })
    })
  })
})
