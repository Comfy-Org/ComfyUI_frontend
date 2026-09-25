import { beforeEach, describe, expect, it, vi } from 'vitest'

import { downloadOutput, jobPhase, runJob } from './run'
import type { ReshootJob, ReshootTransport } from './transport'
import { ReshootError } from './transport'

function fakeTransport(): ReshootTransport {
  return {
    quote: vi.fn(async () => undefined),
    upload: vi.fn(async () => 'clip.mp4'),
    submit: vi.fn(async () => ({ id: 'job-1', status: 'queued' })),
    job: vi.fn(async () => ({ id: 'job-1', status: 'succeeded' })),
    output: vi.fn(async () => new Blob(['bytes'])),
    cancel: vi.fn(async () => {})
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

describe('runJob', () => {
  it('waits out a server that is still starting, every 10 seconds', async () => {
    const transport = fakeTransport()
    vi.mocked(transport.submit)
      .mockRejectedValueOnce(new ReshootError('deployment_not_ready'))
      .mockRejectedValueOnce(new ReshootError('deployment_not_ready'))
    const phases: string[] = []
    const run = runJob(
      transport,
      {},
      (phase) => phases.push(phase),
      new AbortController().signal
    )

    await vi.advanceTimersByTimeAsync(9_999)
    expect(transport.submit).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(transport.submit).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(12_000)

    await expect(run).resolves.toMatchObject({ status: 'succeeded' })
    expect(phases.slice(0, 2)).toEqual(['starting', 'starting'])
    const keys = vi.mocked(transport.submit).mock.calls.map(([, key]) => key)
    expect(new Set(keys).size).toBe(3)
  })

  it('gives up on any other refusal at once', async () => {
    const transport = fakeTransport()
    vi.mocked(transport.submit).mockRejectedValue(
      new ReshootError('insufficient_credits')
    )
    await expect(
      runJob(transport, {}, () => {}, new AbortController().signal)
    ).rejects.toMatchObject({ code: 'insufficient_credits' })
    expect(transport.submit).toHaveBeenCalledTimes(1)
  })

  it('polls until the job succeeds and reads nothing before that', async () => {
    const transport = fakeTransport()
    const statuses = ['running', 'running', 'succeeded']
    vi.mocked(transport.job).mockImplementation(async () => ({
      id: 'job-1',
      status: statuses.shift() ?? 'succeeded',
      outputs: []
    }))
    const run = runJob(transport, {}, () => {}, new AbortController().signal)
    await vi.advanceTimersByTimeAsync(10_000)
    await run
    expect(transport.job).toHaveBeenCalledTimes(3)
    expect(transport.output).not.toHaveBeenCalled()
  })

  it('fails a job the deployment failed', async () => {
    const transport = fakeTransport()
    vi.mocked(transport.job).mockResolvedValue({
      id: 'job-1',
      status: 'failed'
    })
    const failure = runJob(
      transport,
      {},
      () => {},
      new AbortController().signal
    ).catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(2_000)
    expect(await failure).toMatchObject({ code: 'job_failed' })
  })

  it('cancels the job it started when stopped', async () => {
    const transport = fakeTransport()
    vi.mocked(transport.job).mockResolvedValue({
      id: 'job-1',
      status: 'running'
    })
    const stop = new AbortController()
    const stopped = runJob(transport, {}, () => {}, stop.signal).catch(
      (error: unknown) => error
    )
    await vi.advanceTimersByTimeAsync(2_500)
    stop.abort()
    await stopped
    expect(transport.cancel).toHaveBeenCalledWith('job-1')
  })
})

describe('jobPhase', () => {
  it.for<[string, string]>([
    ['succeeded', 'succeeded'],
    ['failed', 'failed'],
    ['cancelled', 'failed'],
    ['queued', 'queued'],
    ['pending', 'queued'],
    ['running', 'running'],
    ['in_progress', 'running']
  ])('reads %s as %s', ([status, phase]) => {
    expect(jobPhase(status)).toBe(phase)
  })
})

describe('downloadOutput', () => {
  const job: ReshootJob = {
    id: 'job-1',
    status: 'succeeded',
    outputs: [
      { id: 'a', filename: 'crossview/warp_00001_.mp4' },
      { id: 'b', filename: 'crossview/result_00001_.mp4' }
    ]
  }

  it('finds an output by its file name', async () => {
    const transport = fakeTransport()
    await downloadOutput(transport, job, 'result', new AbortController().signal)
    expect(transport.output).toHaveBeenCalledWith(
      job,
      job.outputs?.[1],
      expect.any(AbortSignal)
    )
  })

  it('says which output is missing', async () => {
    await expect(
      downloadOutput(
        fakeTransport(),
        job,
        '.cvgeo',
        new AbortController().signal
      )
    ).rejects.toMatchObject({ code: 'missing_output', detail: '.cvgeo' })
  })
})
