import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ReshootError } from '@/lib/workshop/cinematic-studio/reshoot-engine/transport'
import type { SwapJob, SwapPhase } from './run-swap'
import { runSwap, uploadOnce } from './run-swap'
import { sampleTransport } from './sample-transport'

const clip = new File(['clip'], 'clip.mp4', { type: 'video/mp4' })
const hero = new File(['hero'], 'hero.png', { type: 'image/png' })

const job: SwapJob = {
  video: clip,
  character: hero,
  request: {
    target: 'the man',
    start: 1,
    seconds: 5,
    canvas: { width: 1344, height: 768 },
    result: { width: 1344, height: 756 },
    seed: 42
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

describe('runSwap', () => {
  it('uploads both files, waits out the queue and the run, then fetches the result', async () => {
    const transport = sampleTransport(() => 'free')
    const submit = vi.spyOn(transport, 'submit')
    const phases: SwapPhase[] = []

    const running = runSwap(
      transport,
      uploadOnce(transport),
      job,
      (phase) => phases.push(phase),
      new AbortController().signal
    )
    await vi.advanceTimersByTimeAsync(10_000)

    await expect(running).resolves.toBe(clip)
    expect([...new Set(phases)]).toEqual(['queued', 'running', 'fetching'])
    expect(submit).toHaveBeenCalledOnce()
    const sent = JSON.stringify(submit.mock.calls.at(0)?.at(0))
    expect(sent).toContain('sample-1-clip.mp4')
    expect(sent).toContain('sample-2-hero.png')
    expect(sent).toContain('Replace only the man in <Video 1>')
  })

  it('throws the backend failure when the job does not finish', async () => {
    const transport = sampleTransport(() => 'fails')
    const running = runSwap(
      transport,
      uploadOnce(transport),
      job,
      () => undefined,
      new AbortController().signal
    )
    const failed = running.catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(10_000)

    expect(await failed).toMatchObject({ code: 'job_failed' })
  })
})

describe('uploadOnce', () => {
  it('sends the same file once however many takes use it', async () => {
    const transport = sampleTransport(() => 'free')
    const upload = vi.spyOn(transport, 'upload')
    const once = uploadOnce(transport)
    const { signal } = new AbortController()

    const names = await Promise.all([once(clip, signal), once(clip, signal)])
    await once(hero, signal)

    expect(names.at(0)).toBe(names.at(1))
    expect(upload).toHaveBeenCalledTimes(2)
  })

  it('tries a file again after its upload failed', async () => {
    const transport = sampleTransport(() => 'free')
    vi.spyOn(transport, 'upload')
      .mockRejectedValueOnce(new ReshootError('upload_rate_limited'))
      .mockResolvedValueOnce('clip.mp4')
    const once = uploadOnce(transport)
    const { signal } = new AbortController()

    await expect(once(clip, signal)).rejects.toThrow(ReshootError)
    await expect(once(clip, signal)).resolves.toBe('clip.mp4')
  })
})
